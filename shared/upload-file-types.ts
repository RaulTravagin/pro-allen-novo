export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BASE64_LENGTH =
  Math.ceil(MAX_UPLOAD_FILE_BYTES / 3) * 4;

export const POST_POP_FILE_EXTENSIONS = ["pdf", "doc", "docx"] as const;
export const PERSONNEL_DOCUMENT_FILE_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const POST_POP_FILE_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PERSONNEL_DOCUMENT_FILE_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const MIME_ALIASES: Record<string, string> = {
  "application/x-pdf": "application/pdf",
  "application/x-msword": "application/msword",
  "application/vnd.ms-word": "application/msword",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function normalizeReportedMimeType(value: string | null | undefined) {
  const mimeType = value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return MIME_ALIASES[mimeType] ?? mimeType;
}

/** Return the canonical MIME only when the filename extension and reported MIME agree. */
export function resolveUploadMimeType(
  fileName: string,
  reportedMimeType: string | null | undefined,
  allowedExtensions: readonly string[]
): string | null {
  const extension = fileName.trim().toLowerCase().split(".").pop() ?? "";
  if (!extension || !allowedExtensions.includes(extension)) return null;

  const expectedMimeType = MIME_BY_EXTENSION[extension];
  if (!expectedMimeType) return null;

  const reported = normalizeReportedMimeType(reportedMimeType);
  if (
    !reported ||
    reported === "application/octet-stream" ||
    reported === "binary/octet-stream"
  ) {
    return expectedMimeType;
  }
  return reported === expectedMimeType ? expectedMimeType : null;
}

export function resolvePostPopMimeType(
  fileName: string,
  reportedMimeType: string | null | undefined
) {
  return resolveUploadMimeType(
    fileName,
    reportedMimeType,
    POST_POP_FILE_EXTENSIONS
  );
}

export function resolvePersonnelDocumentMimeType(
  fileName: string,
  reportedMimeType: string | null | undefined
) {
  return resolveUploadMimeType(
    fileName,
    reportedMimeType,
    PERSONNEL_DOCUMENT_FILE_EXTENSIONS
  );
}

export function isValidUploadBase64(value: string) {
  if (
    !value.length ||
    value.length > MAX_UPLOAD_BASE64_LENGTH ||
    value.length % 4 !== 0
  )
    return false;
  if (!BASE64_PATTERN.test(value)) return false;

  const paddingStart = value.indexOf("=");
  if (paddingStart < 0) return true;
  const paddingLength = value.length - paddingStart;
  return (
    (paddingLength === 1 && paddingStart % 4 === 3) ||
    (paddingLength === 2 && paddingStart % 4 === 2)
  );
}
