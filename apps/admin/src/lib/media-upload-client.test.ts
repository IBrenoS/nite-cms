import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MediaUploadCanceledError,
  uploadMediaFile,
} from "./media-upload-client";

class FakeXmlHttpRequest {
  static instances: FakeXmlHttpRequest[] = [];
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body?: File;
  status = 200;
  upload = {
    onprogress: undefined as ((event: ProgressEvent) => void) | undefined,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXmlHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: File) {
    this.body = body;
  }

  abort() {
    this.onabort?.();
  }
}

describe("uploadMediaFile", () => {
  beforeEach(() => {
    FakeXmlHttpRequest.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("envia PUT assinado e informa progresso", async () => {
    const onProgress = vi.fn();
    const file = new File(["video"], "video.mp4", { type: "video/mp4" });
    const promise = uploadMediaFile({
      url: "https://upload.nite.test/video",
      headers: { "content-type": "video/mp4", "content-length": "5" },
      file,
      onProgress,
    });
    const request = FakeXmlHttpRequest.instances[0];

    request.upload.onprogress?.({
      lengthComputable: true,
      loaded: 2,
      total: 5,
    } as ProgressEvent);
    request.onload?.();

    await expect(promise).resolves.toBeUndefined();
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("https://upload.nite.test/video");
    expect(request.headers).toEqual({
      "content-type": "video/mp4",
      "content-length": "5",
    });
    expect(request.body).toBe(file);
    expect(onProgress).toHaveBeenCalledWith(40);
  });

  it("cancela sem converter aborto em falha genérica", async () => {
    const controller = new AbortController();
    const promise = uploadMediaFile({
      url: "https://upload.nite.test/video",
      headers: {},
      file: new File(["video"], "video.mp4", { type: "video/mp4" }),
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(MediaUploadCanceledError);
  });

  it("rejeita resposta HTTP sem sucesso", async () => {
    const promise = uploadMediaFile({
      url: "https://upload.nite.test/video",
      headers: {},
      file: new File(["video"], "video.mp4", { type: "video/mp4" }),
    });
    const request = FakeXmlHttpRequest.instances[0];
    request.status = 403;
    request.onload?.();

    await expect(promise).rejects.toThrow("HTTP 403");
  });
});
