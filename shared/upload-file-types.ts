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

function readUint16LE(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return bytes[offset]! * 0x1000000 +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!;
}

function containsBytes(bytes: Uint8Array, needle: readonly number[], start = 0, end = bytes.length) {
  const lastStart = Math.min(end, bytes.length) - needle.length;
  for (let offset = Math.max(0, start); offset <= lastStart; offset++) {
    let index = 0;
    for (; index < needle.length; index++) {
      if (bytes[offset + index] !== needle[index]) break;
    }
    if (index === needle.length) return true;
  }
  return false;
}

function containsAscii(bytes: Uint8Array, text: string, start = 0, end = bytes.length) {
  return containsBytes(bytes, Array.from(text, (character) => character.charCodeAt(0)), start, end);
}

function hasDocxPackage(bytes: Uint8Array) {
  const searchStart = Math.max(0, bytes.length - 22 - 0xffff);
  let endRecordOffset = -1;
  for (let offset = bytes.length - 22; offset >= searchStart; offset--) {
    if (readUint32LE(bytes, offset) === 0x06054b50) {
      endRecordOffset = offset;
      break;
    }
  }
  if (endRecordOffset < 0) return false;

  const diskNumber = readUint16LE(bytes, endRecordOffset + 4);
  const centralDisk = readUint16LE(bytes, endRecordOffset + 6);
  const entryCount = readUint16LE(bytes, endRecordOffset + 10);
  const centralSize = readUint32LE(bytes, endRecordOffset + 12);
  const centralOffset = readUint32LE(bytes, endRecordOffset + 16);
  const commentLength = readUint16LE(bytes, endRecordOffset + 20);
  if (
    diskNumber !== 0 || centralDisk !== 0 || entryCount === null || entryCount === 0xffff ||
    centralSize === null || centralOffset === null || commentLength === null ||
    endRecordOffset + 22 + commentLength > bytes.length ||
    centralOffset + centralSize > endRecordOffset
  ) return false;

  const requiredEntries = new Set(["[Content_Types].xml", "word/document.xml"]);
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index++) {
    if (readUint32LE(bytes, offset) !== 0x02014b50) return false;
    const flags = readUint16LE(bytes, offset + 8);
    const compressionMethod = readUint16LE(bytes, offset + 10);
    const compressedSize = readUint32LE(bytes, offset + 20);
    const uncompressedSize = readUint32LE(bytes, offset + 24);
    const fileNameLength = readUint16LE(bytes, offset + 28);
    const extraLength = readUint16LE(bytes, offset + 30);
    const fileCommentLength = readUint16LE(bytes, offset + 32);
    const localHeaderOffset = readUint32LE(bytes, offset + 42);
    if (
      flags === null || (flags & 1) !== 0 ||
      (compressionMethod !== 0 && compressionMethod !== 8) ||
      compressedSize === null || uncompressedSize === null || fileNameLength === null ||
      extraLength === null || fileCommentLength === null || localHeaderOffset === null
    ) return false;

    const entryEnd = offset + 46 + fileNameLength + extraLength + fileCommentLength;
    if (entryEnd > centralOffset + centralSize) return false;
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + fileNameLength);
    const name = new TextDecoder().decode(nameBytes);
    if (requiredEntries.has(name)) {
      if (compressedSize === 0 || uncompressedSize === 0) return false;
      if (readUint32LE(bytes, localHeaderOffset) !== 0x04034b50) return false;
      const localNameLength = readUint16LE(bytes, localHeaderOffset + 26);
      const localExtraLength = readUint16LE(bytes, localHeaderOffset + 28);
      if (localNameLength !== fileNameLength || localExtraLength === null) return false;
      const localName = bytes.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength);
      if (new TextDecoder().decode(localName) !== name) return false;
      requiredEntries.delete(name);
    }
    offset = entryEnd;
  }
  return requiredEntries.size === 0;
}

/** Validate bytes against the canonical MIME; filenames and client MIME alone are not trusted. */
export function isValidUploadContent(bytes: Uint8Array, mimeType: string) {
  if (!bytes.length) return false;
  switch (mimeType) {
    case "application/pdf":
      return containsAscii(bytes, "%PDF-", 0, Math.min(bytes.length, 1024)) &&
        containsAscii(bytes, "%%EOF", Math.max(0, bytes.length - 1024));
    case "image/jpeg":
      return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
        containsBytes(bytes, [0xff, 0xd9], 3);
    case "image/png":
      return bytes.length >= 57 &&
        containsBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0, 8) &&
        readUint32BE(bytes, 8) === 13 && containsAscii(bytes, "IHDR", 12, 16) &&
        readUint32BE(bytes, 16)! > 0 && readUint32BE(bytes, 20)! > 0 &&
        containsAscii(bytes, "IDAT", 37, bytes.length - 12) &&
        readUint32BE(bytes, bytes.length - 12) === 0 &&
        containsAscii(bytes, "IEND", bytes.length - 8, bytes.length - 4);
    case "image/webp": {
      if (bytes.length < 20) return false;
      const chunkType = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
      const chunkSize = readUint32LE(bytes, 16);
      return containsAscii(bytes, "RIFF", 0, 4) &&
        readUint32LE(bytes, 4) === bytes.length - 8 && containsAscii(bytes, "WEBP", 8, 12) &&
        ["VP8 ", "VP8L", "VP8X"].includes(chunkType) && chunkSize !== null && chunkSize > 0 &&
        20 + chunkSize <= bytes.length;
    }
    case "application/msword":
      return containsBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0, 8) &&
        containsBytes(bytes, Array.from("WordDocument", (character) => [character.charCodeAt(0), 0]).flat());
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return hasDocxPackage(bytes);
    default:
      return false;
  }
}
