import { describe, expect, it } from "vitest";
import { isValidCoordinatePair } from "../shared/geographic-coordinates";

describe("validação de coordenadas geográficas", () => {
  it("permite coordenadas opcionais somente quando ambas estão ausentes", () => {
    expect(isValidCoordinatePair(undefined, undefined)).toBe(true);
    expect(isValidCoordinatePair(-23.5, undefined)).toBe(false);
    expect(isValidCoordinatePair(undefined, -46.6)).toBe(false);
  });

  it.each([
    [-90, -180],
    [90, 180],
    [0, 0],
    [-23.5, -46.6],
  ])("aceita par dentro dos limites (%s, %s)", (latitude, longitude) => {
    expect(isValidCoordinatePair(latitude, longitude)).toBe(true);
  });

  it.each([
    [-90.0001, 0],
    [90.0001, 0],
    [0, -180.0001],
    [0, 180.0001],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
  ])("rejeita coordenada impossível (%s, %s)", (latitude, longitude) => {
    expect(isValidCoordinatePair(latitude, longitude)).toBe(false);
  });
});
