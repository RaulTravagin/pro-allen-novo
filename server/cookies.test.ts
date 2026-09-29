import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

function request(protocol: string, forwardedProto?: string) {
  return {
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
  } as never;
}

describe("cookies de sessão", () => {
  it("usa HttpOnly e SameSite Lax no acesso normal", () => {
    expect(getSessionCookieOptions(request("https"))).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  });

  it("considera HTTPS encaminhado pelo proxy sem confiar em valores de cookie do cliente", () => {
    expect(getSessionCookieOptions(request("http", "https, http"))).toMatchObject({
      secure: true,
      sameSite: "lax",
    });
  });
});
