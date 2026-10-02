import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_FILE_BYTES } from "../shared/upload-file-types";

const storageMocks = vi.hoisted(() => ({ storagePut: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: storageMocks.storagePut }));

import { uploadPersonnelDocument } from "./db";

const validJpegBytes = Buffer.from([
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAFA3PEY8MlBGQUZaVVBfeMiCeG5uePWvuZHI////////////",
  "////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAA",
  "AAAABP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AE//Z",
].join(""), "base64");

const validJpeg = (size = validJpegBytes.length) => {
  if (size < validJpegBytes.length) return validJpegBytes.subarray(0, size);
  let remaining = size - validJpegBytes.length;
  const commentSegments: Buffer[] = [];
  while (remaining > 0) {
    let segmentSize = Math.min(remaining, 0xffff + 2);
    const leftover = remaining - segmentSize;
    if (leftover > 0 && leftover < 4) segmentSize -= 4 - leftover;
    if (segmentSize < 4) throw new Error("Tamanho insuficiente para segmento JPEG COM");
    const payloadLength = segmentSize - 4;
    const segment = Buffer.alloc(segmentSize);
    segment[0] = 0xff;
    segment[1] = 0xfe;
    segment.writeUInt16BE(payloadLength + 2, 2);
    commentSegments.push(segment);
    remaining -= segmentSize;
  }
  return Buffer.concat([
    validJpegBytes.subarray(0, 2),
    ...commentSegments,
    validJpegBytes.subarray(2),
  ]);
};

describe("armazenamento privado de atestados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.storagePut.mockResolvedValue({
      key: "personnel/occurrences/17/fake-upload.jpeg",
      url: "/manus-storage/personnel/occurrences/17/fake-upload.jpeg",
    });
  });

  it("salva imagem com MIME canônico no namespace privado vinculado ao supervisor", async () => {
    const bytes = validJpeg();
    const base64 = bytes.toString("base64");
    await uploadPersonnelDocument(17, {
      name: "atestado.jpeg",
      mimeType: "application/octet-stream",
      base64,
    });

    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^personnel\/occurrences\/17\/[0-9a-f-]+-atestado\.jpeg$/i),
      bytes,
      "image/jpeg",
    );
  });

  it("mantém o limite exato existente de 10 MB para conteúdo JPEG", async () => {
    const bytes = validJpeg(MAX_UPLOAD_FILE_BYTES);
    const base64 = bytes.toString("base64");
    await expect(
      uploadPersonnelDocument(17, {
        name: "atestado.jpg",
        mimeType: "image/jpeg",
        base64,
      }),
    ).resolves.toMatchObject({
      url: "/manus-storage/personnel/occurrences/17/fake-upload.jpeg",
    });
    const [key, storedBytes, mimeType] = storageMocks.storagePut.mock.calls[0] as [string, Buffer, string];
    expect(key).toMatch(/^personnel\/occurrences\/17\//);
    expect(Buffer.compare(storedBytes, bytes)).toBe(0);
    expect(mimeType).toBe("image/jpeg");
  });

  it.each([
    { name: "atestado.svg", mimeType: "image/svg+xml" },
    { name: "atestado.png", mimeType: "image/jpeg" },
  ])("não envia extensão/MIME inválido ao storage (%s)", async ({ name, mimeType }) => {
    const base64 = Buffer.from("fixture").toString("base64");
    await expect(uploadPersonnelDocument(17, { name, mimeType, base64 })).rejects.toThrow("Formato de atestado não suportado");
    expect(storageMocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejeita bytes arbitrários com extensão e MIME de imagem antes do storage", async () => {
    const base64 = Buffer.from("texto que não é uma imagem").toString("base64");
    await expect(uploadPersonnelDocument(17, { name: "atestado.jpeg", mimeType: "image/jpeg", base64 }))
      .rejects.toThrow("O conteúdo do atestado não corresponde ao formato informado");
    expect(storageMocks.storagePut).not.toHaveBeenCalled();
  });
});
