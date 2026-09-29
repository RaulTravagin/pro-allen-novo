import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getUserById } from "../db";
import { getLocalSupervisorSessionUserId } from "../local-supervisor-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    const localSupervisorId = await getLocalSupervisorSessionUserId(req);
    if (localSupervisorId) {
      user = await getUserById(localSupervisorId) ?? null;
    }
  }

  if (user?.isOperational === false) {
    user = null;
  }

  return user;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: await getAuthenticatedUser(opts.req),
  };
}
