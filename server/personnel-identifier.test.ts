import { describe, expect, it } from "vitest";
import {
  normalizePersonnelIdentifier,
  personnelIdentifierSchema,
} from "../shared/personnelIdentifier";

describe("personnel identifier validation", () => {
  it.each(["3", "79", "425"])(
    "accepts numeric identifiers with %s",
    identifier => {
      expect(personnelIdentifierSchema.parse(identifier)).toBe(identifier);
    }
  );

  it("trims surrounding whitespace without dropping a leading zero", () => {
    expect(personnelIdentifierSchema.parse(" 06371 ")).toBe("06371");
  });

  it("continues to accept and normalize an 11-digit CPF", () => {
    const cpf = "529.982.247-25";
    expect(personnelIdentifierSchema.parse(cpf)).toBe(cpf);
    expect(normalizePersonnelIdentifier(cpf)).toBe("52998224725");
  });

  it.each(["", "   "])("rejects empty identifiers after trimming", value => {
    expect(personnelIdentifierSchema.safeParse(value).success).toBe(false);
  });

  it("rejects identifiers longer than the existing 14-character maximum", () => {
    expect(personnelIdentifierSchema.safeParse("123456789012345").success).toBe(
      false
    );
  });

  it("continues to require string input", () => {
    expect(personnelIdentifierSchema.safeParse(79).success).toBe(false);
  });
});
