import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BASE64_LENGTH,
  MAX_UPLOAD_FILE_BYTES,
  PERSONNEL_DOCUMENT_FILE_ACCEPT,
  isValidUploadBase64,
  resolvePersonnelDocumentMimeType,
  resolvePostPopMimeType,
} from "../shared/upload-file-types";

describe("normalização de tipo dos anexos", () => {
  it.each([
    ["procedimento.doc", "application/msword", "application/msword"],
    ["procedimento.DOC", "application/vnd.ms-word", "application/msword"],
    ["procedimento.doc", "application/octet-stream", "application/msword"],
    [
      "procedimento.docx",
      "",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "procedimento.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["procedimento.pdf", "application/pdf", "application/pdf"],
  ])(
    "normaliza arquivo POP %s com MIME %s",
    (name, reportedMime, expectedMime) => {
      expect(resolvePostPopMimeType(name, reportedMime)).toBe(expectedMime);
    }
  );

  it.each([
    ["atestado.jpg", "image/jpeg", "image/jpeg"],
    ["atestado.jpeg", "image/jpg", "image/jpeg"],
    ["atestado.JPEG", "", "image/jpeg"],
    ["atestado.png", "application/octet-stream", "image/png"],
    ["atestado.webp", "image/webp", "image/webp"],
    ["atestado.pdf", "application/pdf", "application/pdf"],
  ])(
    "normaliza imagem/documento pessoal %s com MIME %s",
    (name, reportedMime, expectedMime) => {
      expect(resolvePersonnelDocumentMimeType(name, reportedMime)).toBe(
        expectedMime
      );
    }
  );

  it.each([
    ["atestado.svg", "image/svg+xml"],
    ["atestado.svg", "application/octet-stream"],
    ["atestado.png", "image/svg+xml"],
    ["atestado.png", "image/jpeg"],
    ["atestado.exe", "application/octet-stream"],
  ])("rejeita atestado incompatível %s (%s)", (name, reportedMime) => {
    expect(resolvePersonnelDocumentMimeType(name, reportedMime)).toBeNull();
  });

  it.each([
    ["rotina.doc", "text/plain"],
    ["rotina.docx", "application/pdf"],
    ["rotina.svg", "image/svg+xml"],
  ])("rejeita POP incompatível %s (%s)", (name, reportedMime) => {
    expect(resolvePostPopMimeType(name, reportedMime)).toBeNull();
  });

  it("mantém o limite de 10 MB e rejeita base64 malformado ou acima do tamanho codificado permitido", () => {
    expect(MAX_UPLOAD_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_UPLOAD_BASE64_LENGTH).toBe(
      Math.ceil((10 * 1024 * 1024) / 3) * 4
    );
    expect(isValidUploadBase64("ZmljdGljaW8=")).toBe(true);
    expect(isValidUploadBase64("%%%=")).toBe(false);
    expect(isValidUploadBase64("A".repeat(MAX_UPLOAD_BASE64_LENGTH + 4))).toBe(
      false
    );
  });

  it("publica no seletor de atestados as extensões raster comuns, sem SVG", () => {
    expect(PERSONNEL_DOCUMENT_FILE_ACCEPT).toContain(".jpg");
    expect(PERSONNEL_DOCUMENT_FILE_ACCEPT).toContain(".jpeg");
    expect(PERSONNEL_DOCUMENT_FILE_ACCEPT).toContain(".png");
    expect(PERSONNEL_DOCUMENT_FILE_ACCEPT).toContain(".webp");
    expect(PERSONNEL_DOCUMENT_FILE_ACCEPT).not.toContain(".svg");
  });
});
