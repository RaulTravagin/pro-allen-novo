/* @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PostPopManagement from "./PostPopManagement";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  invalidate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      gestor: { postPops: { list: { invalidate: mocks.invalidate } } },
    }),
    gestor: {
      postPops: {
        list: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
        upload: {
          useMutation: () => ({ isPending: false, mutateAsync: mocks.upload }),
        },
        delete: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      },
    },
    postPops: {
      downloadUrl: {
        useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

describe("seletor de POP no cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ id: 77 });
  });

  it("anuncia PDF/DOC/DOCX e canonicaliza MIME genérico usando a extensão", async () => {
    render(<PostPopManagement postId={31} />);
    const input = screen.getByLabelText(
      "Selecionar POP para o posto 31"
    ) as HTMLInputElement;
    expect(input.accept).toContain(".doc");
    expect(input.accept).toContain(".docx");

    const file = new File(["word fixture"], "procedimento.docx", {
      type: "application/octet-stream",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(mocks.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 31,
          name: "procedimento.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      )
    );
  });
});
