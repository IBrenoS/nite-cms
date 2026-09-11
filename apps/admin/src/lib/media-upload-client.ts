"use client";

export class MediaUploadCanceledError extends Error {
  constructor() {
    super("Upload cancelado.");
    this.name = "MediaUploadCanceledError";
  }
}

export function uploadMediaFile(input: {
  url: string;
  headers: Record<string, string>;
  file: File;
  signal?: AbortSignal;
  onProgress?: (percentage: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;

    const finish = (result: "resolve" | "reject", error?: Error) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", abort);
      if (result === "resolve") resolve();
      else reject(error ?? new Error("A transferência da mídia falhou."));
    };
    const abort = () => request.abort();

    request.open("PUT", input.url);
    for (const [name, value] of Object.entries(input.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      input.onProgress?.(
        Math.min(100, Math.round((event.loaded / event.total) * 100)),
      );
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        input.onProgress?.(100);
        finish("resolve");
      } else {
        finish("reject", new Error(`Upload recusado: HTTP ${request.status}.`));
      }
    };
    request.onerror = () =>
      finish("reject", new Error("A transferência da mídia falhou."));
    request.onabort = () => finish("reject", new MediaUploadCanceledError());

    if (input.signal?.aborted) {
      request.abort();
      return;
    }
    input.signal?.addEventListener("abort", abort, { once: true });
    request.send(input.file);
  });
}
