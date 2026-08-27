import { describe, expect, it } from "vitest";
import {
  isNetworkOrHttpError,
  supervisorErrorMessage,
} from "./networkFeedback";

describe("networkFeedback", () => {
  it("classifica erro HTTP 5xx como indisponibilidade de conexão", () => {
    const error = { data: { httpStatus: 503 }, message: "Service Unavailable" };

    expect(isNetworkOrHttpError(error)).toBe(true);
    expect(supervisorErrorMessage(error, "fallback")).toBe(
      "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
    );
  });

  it("preserva a mensagem de erro funcional", () => {
    const error = {
      data: { httpStatus: 400 },
      message: "Justificativa obrigatória",
    };

    expect(isNetworkOrHttpError(error)).toBe(false);
    expect(supervisorErrorMessage(error, "fallback")).toBe(
      "Justificativa obrigatória"
    );
  });
});
