import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_FILE_BYTES } from "../shared/upload-file-types";

const storageMocks = vi.hoisted(() => ({ storagePut: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: storageMocks.storagePut }));

import { uploadPersonnelDocument } from "./db";

describe("armazenamento privado de atestados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.storagePut.mockResolvedValue({
      key: "personnel/occurrences/17/fake-upload.jpeg",
      url: "/manus-storage/personnel/occurrences/17/fake-upload.jpeg",
    });
  });

  it("salva imagem com MIME canônico no namespace privado vinculado ao supervisor", async () => {
    const base64 = Buffer.from("fixture-only medical image").toString("base64");
    await uploadPersonnelDocument(17, {
      name: "atestado.jpeg",
      mimeType: "application/octet-stream",
      base64,
    });

    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(
        /^personnel\/occurrences\/17\/[0-9a-f-]+-atestado\.jpeg$/i
      ),
      Buffer.from(base64, "base64"),
      "image/jpeg"
    );
  });

  it("mantém o limite exato existente de 10 MB", async () => {
    const base64 = Buffer.alloc(MAX_UPLOAD_FILE_BYTES, 65).toString("base64");
    await expect(
      uploadPersonnelDocument(17, {
        name: "atestado.jpg",
        mimeType: "image/jpeg",
        base64,
      })
    ).resolves.toMatchObject({
      url: "/manus-storage/personnel/occurrences/17/fake-upload.jpeg",
    });
    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^personnel\/occurrences\/17\//),
      expect.any(Buffer),
      "image/jpeg"
    );
  });

  it.each([
    { name: "atestado.svg", mimeType: "image/svg+xml" },
    { name: "atestado.png", mimeType: "image/jpeg" },
  ])(
    "não envia extensão/MIME inválido ao storage (%s)",
    async ({ name, mimeType }) => {
      const base64 = Buffer.from("fixture").toString("base64");
      await expect(
        uploadPersonnelDocument(17, { name, mimeType, base64 })
      ).rejects.toThrow("Formato de atestado não suportado");
      expect(storageMocks.storagePut).not.toHaveBeenCalled();
    }
  );
});
