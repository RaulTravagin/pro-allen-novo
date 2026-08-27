import { toast } from "sonner";

type ErrorWithNetworkHints = {
  message?: unknown;
  data?: { code?: unknown; httpStatus?: unknown; httpStatusText?: unknown };
  shape?: { message?: unknown };
};

function errorMessage(error: unknown) {
  const candidate = error as ErrorWithNetworkHints | undefined;
  if (typeof candidate?.message === "string") return candidate.message;
  if (typeof candidate?.shape?.message === "string")
    return candidate.shape.message;
  return "";
}

export function isNetworkOrHttpError(error: unknown) {
  const candidate = error as ErrorWithNetworkHints | undefined;
  const message = errorMessage(error).toLowerCase();
  const httpStatus = Number(candidate?.data?.httpStatus ?? 0);
  return (
    httpStatus >= 500 ||
    /failed to fetch|network|timeout|timed out|connection|socket|econn|502|503|504|http error|servidor indisponível/.test(
      message
    )
  );
}

export function supervisorErrorMessage(error: unknown, fallback: string) {
  if (isNetworkOrHttpError(error))
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  const message = errorMessage(error).trim();
  return message || fallback;
}

let lastNetworkNoticeAt = 0;

export function notifySupervisorError(error: unknown, fallback: string) {
  const networkError = isNetworkOrHttpError(error);
  const now = Date.now();
  if (networkError && now - lastNetworkNoticeAt < 6_000) return;
  if (networkError) lastNetworkNoticeAt = now;
  toast.error(supervisorErrorMessage(error, fallback));
}
