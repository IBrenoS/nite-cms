import { createServer } from "node:http";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

const previewPath = "/api/preview/resolve";
const privateHeaders = {
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
};

function json(response, statusCode, body) {
  response.writeHead(statusCode, privateHeaders);
  response.end(JSON.stringify(body));
}

function forwardedHeaders(request) {
  const headers = new Headers();
  for (const name of ["accept", "authorization"]) {
    const value = request.headers[name];
    if (typeof value === "string" && value) headers.set(name, value);
  }
  return headers;
}

export function createPreviewTunnelProxy({
  adminOrigin = "http://127.0.0.1:3001",
  requestTimeoutMilliseconds = 7_000,
} = {}) {
  const endpoint = new URL(previewPath, adminOrigin);

  return createServer(async (request, response) => {
    request.resume();
    if (request.method !== "POST" || request.url !== previewPath) {
      json(response, 404, { error: "not_found" });
      return;
    }

    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
        headers: forwardedHeaders(request),
      });
      const headers = { "cache-control": "private, no-store" };
      const contentType = upstream.headers.get("content-type");
      if (contentType) headers["content-type"] = contentType;
      response.writeHead(upstream.status, headers);
      if (!upstream.body) {
        response.end();
        return;
      }
      await pipeline(Readable.fromWeb(upstream.body), response);
    } catch {
      if (!response.headersSent) {
        json(response, 502, { error: "preview_proxy_unavailable" });
      } else {
        response.destroy();
      }
    }
  });
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href,
  );
}

if (isMainModule()) {
  const host = "127.0.0.1";
  const port = 3011;
  const server = createPreviewTunnelProxy();
  server.on("error", () => {
    console.error("preview_tunnel_proxy_failed");
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.info(`preview_tunnel_proxy_ready http://${host}:${port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => server.close());
  }
}
