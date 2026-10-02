import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

const oauthMocks = vi.hoisted(() => ({
  upsertUser: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("../db", () => ({ upsertUser: oauthMocks.upsertUser }));
vi.mock("./sdk", () => ({
  sdk: {
    exchangeCodeForToken: oauthMocks.exchangeCodeForToken,
    getUserInfo: oauthMocks.getUserInfo,
    createSessionToken: oauthMocks.createSessionToken,
  },
}));

import { registerOAuthRoutes } from "./oauth";

type CallbackHandler = (req: Request, res: Response) => Promise<void>;

describe("callback OAuth e persistência do usuário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oauthMocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "fixture-access-token" });
    oauthMocks.getUserInfo.mockResolvedValue({ openId: "oauth-fixture-user", name: "Fixture User" });
    oauthMocks.upsertUser.mockRejectedValue(new Error("Database not available"));
  });

  afterEach(() => vi.restoreAllMocks());

  it("retorna erro e não cria sessão/cookie quando upsertUser não persiste", async () => {
    const nonce = "fixture-state-nonce";
    const state = encodeOAuthState({ redirectUri: "/", nonce });
    let callback: CallbackHandler | undefined;
    const app = {
      get: (_path: string, handler: unknown) => {
        callback = handler as CallbackHandler;
      },
    } as unknown as Express;
    registerOAuthRoutes(app);
    if (!callback) throw new Error("Callback OAuth não foi registrado");

    const request = {
      query: { code: "fixture-code", state },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${nonce}` },
      protocol: "https",
    } as unknown as Request;
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    vi.spyOn(console, "error").mockImplementation(() => {});

    await callback(request, response);

    expect(oauthMocks.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "oauth-fixture-user" }));
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ error: "OAuth callback failed" });
    expect(oauthMocks.createSessionToken).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).not.toHaveBeenCalled();
  });
});
