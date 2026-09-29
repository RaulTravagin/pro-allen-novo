import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import React, { useRef } from "react";
import { toast } from "sonner";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
type PopMimeType = "application/pdf" | "application/msword" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function allowedMimeType(file: File): PopMimeType | null {
  const extension = file.name.toLowerCase().split(".").pop();
  const fallback = extension === "pdf" ? "application/pdf"
    : extension === "doc" ? "application/msword"
      : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : null;
  const mimeType = file.type || fallback;
  return mimeType === "application/pdf" || mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ? mimeType
    : null;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) reject(new Error("Formato do arquivo inválido"));
      else resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function PostPopManagement({ postId }: { postId: number }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const documents = trpc.gestor.postPops.list.useQuery({ postId });
  const upload = trpc.gestor.postPops.upload.useMutation({
    onSuccess: async () => {
      await utils.gestor.postPops.list.invalidate({ postId });
      toast.success("POP anexado ao posto.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível anexar o POP"),
  });
  const remove = trpc.gestor.postPops.delete.useMutation({
    onSuccess: async () => {
      await utils.gestor.postPops.list.invalidate({ postId });
      toast.success("Anexo removido da lista do posto.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível remover o POP"),
  });
  const download = trpc.postPops.downloadUrl.useMutation();

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      toast.error("O arquivo deve ter até 10 MB.");
      return;
    }
    const mimeType = allowedMimeType(file);
    if (!mimeType) {
      toast.error("São aceitos arquivos PDF, DOC ou DOCX.");
      return;
    }
    try {
      await upload.mutateAsync({ postId, name: file.name, mimeType, base64: await fileToBase64(file) });
    } catch {
      // A mutation apresenta a mensagem do servidor.
    }
  }

  async function openDocument(documentId: number) {
    try {
      const result = await download.mutateAsync({ postId, documentId });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o POP");
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3" aria-label="Procedimentos Operacionais Padrão">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4 text-emerald-700" /> POPs do posto
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          aria-label={`Selecionar POP para o posto ${postId}`}
          onChange={onFileSelected}
        />
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()} className="gap-1.5">
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Anexar POP
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">PDF, DOC ou DOCX, até 10 MB. O acesso é restrito à gestão e à equipe vinculada à rota.</p>
      {documents.isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando anexos…</p>
      ) : documents.error ? (
        <p className="mt-2 text-xs text-rose-700">Não foi possível carregar os POPs deste posto.</p>
      ) : documents.data?.length ? (
        <ul className="mt-2 space-y-2">
          {documents.data.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="min-w-0 break-all text-sm text-slate-700">{document.originalName}</span>
              <span className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" disabled={download.isPending} aria-label={`Abrir ${document.originalName}`} onClick={() => void openDocument(document.id)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={remove.isPending} aria-label={`Remover ${document.originalName}`} onClick={() => {
                  if (window.confirm(`Remover “${document.originalName}” dos POPs deste posto?`)) remove.mutate({ postId, documentId: document.id });
                }} className="text-rose-700 hover:text-rose-800">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Nenhum POP anexado.</p>
      )}
    </div>
  );
}
