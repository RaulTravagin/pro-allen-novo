import { describe, expect, it } from "vitest";
import { geolocationErrorMessage, geolocationUnavailableMessage } from "./geolocationFeedback";

describe("feedback de geolocalização", () => {
  it("orienta como liberar a permissão negada e informa que a visita continua", () => {
    const message = geolocationErrorMessage(1);
    expect(message).toContain("permita Localização");
    expect(message).toContain("continuará sendo registrada sem coordenadas");
  });

  it("explica que GPS é opcional quando o navegador não oferece o recurso", () => {
    expect(geolocationUnavailableMessage()).toContain("será registrada sem coordenadas");
  });
});
