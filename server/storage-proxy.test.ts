import { describe, expect, it } from "vitest";
import { isSafeStorageKey, personnelOccurrenceOwnerId } from "./_core/storageProxy";

describe("proxy protegido de documentos", () => {
  it("aceita somente caminhos relativos sem traversal", () => {
    expect(isSafeStorageKey("personnel/occurrences/7/document.pdf")).toBe(true);
    expect(isSafeStorageKey("/personnel/occurrences/7/document.pdf")).toBe(false);
    expect(isSafeStorageKey("personnel/occurrences/7/../document.pdf")).toBe(false);
    expect(isSafeStorageKey("personnel\\occurrences\\7\\document.pdf")).toBe(false);
  });

  it("identifica o usuário proprietário do atestado", () => {
    expect(personnelOccurrenceOwnerId("personnel/occurrences/42/abc.pdf")).toBe(42);
    expect(personnelOccurrenceOwnerId("generated/abc.png")).toBeNull();
  });
});
