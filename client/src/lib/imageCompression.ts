export type ImageCompressionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxBytes?: number;
};

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 1_600,
  maxHeight: 1_600,
  quality: 0.82,
  maxBytes: 1_500_000,
};

function isRasterImage(file: File) {
  return /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type);
}

function createImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a imagem selecionada"));
    };
    image.src = objectUrl;
  });
}

async function decodeImage(
  file: File
): Promise<{ width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const image = await createImageElement(file);
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

function renderCompressedBlob(
  file: File,
  width: number,
  height: number,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      reject(
        new Error("Seu navegador não oferece canvas para comprimir a imagem")
      );
      return;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else
            reject(
              new Error("Não foi possível gerar a versão comprimida da imagem")
            );
        },
        "image/jpeg",
        quality
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível processar a imagem selecionada"));
    };
    image.src = objectUrl;
  });
}

/**
 * Prepara uma foto para upload no navegador. JPEG, PNG, WebP e HEIC/HEIF com codec disponível são convertidos
 * para JPEG otimizado. Formatos sem codec raster nativo, como HEIC/HEIF, e
 * arquivos não-imagem retornam intactos para não bloquear o fluxo de envio.
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {}
) {
  if (!isRasterImage(file)) return file;

  const config = {
    maxWidth: Math.max(1, options.maxWidth ?? DEFAULT_OPTIONS.maxWidth),
    maxHeight: Math.max(1, options.maxHeight ?? DEFAULT_OPTIONS.maxHeight),
    quality: Math.min(
      0.95,
      Math.max(0.45, options.quality ?? DEFAULT_OPTIONS.quality)
    ),
    maxBytes: Math.max(1, options.maxBytes ?? DEFAULT_OPTIONS.maxBytes),
  };

  let decoded: { width: number; height: number; close?: () => void };
  try {
    decoded = await decodeImage(file);
  } catch {
    return file;
  }

  if (!decoded.width || !decoded.height) {
    decoded.close?.();
    return file;
  }

  const initialScale = Math.min(
    1,
    config.maxWidth / decoded.width,
    config.maxHeight / decoded.height
  );
  let width = Math.max(1, Math.round(decoded.width * initialScale));
  let height = Math.max(1, Math.round(decoded.height * initialScale));
  decoded.close?.();

  let quality = config.quality;
  let blob = await renderCompressedBlob(file, width, height, quality);
  while (blob.size > config.maxBytes && quality > 0.5) {
    quality = Math.max(0.5, quality - 0.08);
    blob = await renderCompressedBlob(file, width, height, quality);
  }

  // Se a qualidade mínima ainda não for suficiente, reduzimos a resolução
  // progressivamente para evitar enviar fotos excessivamente grandes.
  while (blob.size > config.maxBytes && (width > 480 || height > 480)) {
    width = Math.max(480, Math.round(width * 0.8));
    height = Math.max(480, Math.round(height * 0.8));
    blob = await renderCompressedBlob(file, width, height, 0.5);
  }

  if (
    blob.size >= file.size &&
    file.size <= config.maxBytes &&
    initialScale === 1
  )
    return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
