import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { closeDatabasePool } from "../db";

let activeServer: ReturnType<typeof createServer> | null = null;
let restartTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

function logProcessFailure(source: string, error: unknown) {
  console.error(`[Runtime] ${source}:`, error);
}

function scheduleRestart(error: unknown) {
  logProcessFailure("Falha de inicialização do servidor", error);
  if (isShuttingDown || restartTimer) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void startServer().catch(scheduleRestart);
  }, 5_000);
  restartTimer.unref();
}

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.info(`[Runtime] ${signal} recebido; encerrando conexões de forma controlada.`);
  await new Promise<void>((resolve) => activeServer ? activeServer.close(() => resolve()) : resolve());
  await closeDatabasePool();
}

process.on("unhandledRejection", (reason) => logProcessFailure("Promessa não tratada", reason));
process.on("uncaughtException", (error) => logProcessFailure("Exceção não tratada", error));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  activeServer = server;
  server.on("error", (error) => {
    logProcessFailure("Erro do servidor HTTP", error);
    if (!isShuttingDown) scheduleRestart(error);
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "pro-allen" });
  });
  if (process.env.MANUS_OAUTH_ENABLED !== "false") {
    registerStorageProxy(app);
    registerOAuthRoutes(app);
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

void startServer().catch(scheduleRestart);
