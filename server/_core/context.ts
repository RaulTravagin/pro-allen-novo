import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getUserById } from "../db";
import { getLocalSupervisorSessionUserId } from "../local-supervisor-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    const localSupervisorId = await getLocalSupervisorSessionUserId(opts.req);
    if (localSupervisorId) {
      user = await getUserById(localSupervisorId) ?? null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
