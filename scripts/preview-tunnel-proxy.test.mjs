import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

import { createPreviewTunnelProxy } from "./preview-tunnel-proxy.mjs";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  server.closeAllConnections?.();
  server.close();
  await once(server, "close");
}

test("encaminha somente o POST de resolução com headers permitidos", async (t) => {
  let received;
  const admin = createServer((request, response) => {
    received = {
      method: request.method,
      url: request.url,
      headers: request.headers,
    };
    response.writeHead(201, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "set-cookie": "internal=must-not-leak",
      "x-internal": "must-not-leak",
    });
    response.end('{"revisionId":"revision-1"}');
  });
  const adminOrigin = await listen(admin);
  t.after(() => close(admin));

  const proxy = createPreviewTunnelProxy({ adminOrigin });
  const proxyOrigin = await listen(proxy);
  t.after(() => close(proxy));

  const response = await fetch(`${proxyOrigin}/api/preview/resolve`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: "Bearer private-preview-token",
      cookie: "must-not-forward=1",
      "x-untrusted": "must-not-forward",
    },
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { revisionId: "revision-1" });
  assert.equal(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("x-internal"), null);
  assert.equal(received.method, "POST");
  assert.equal(received.url, "/api/preview/resolve");
  assert.equal(received.headers.authorization, "Bearer private-preview-token");
  assert.equal(received.headers.accept, "application/json");
  assert.equal(received.headers.cookie, undefined);
  assert.equal(received.headers["x-untrusted"], undefined);
});

test("oculta todas as demais rotas e métodos sem alcançar o Admin", async (t) => {
  let requests = 0;
  const admin = createServer((_request, response) => {
    requests += 1;
    response.end();
  });
  const adminOrigin = await listen(admin);
  t.after(() => close(admin));

  const proxy = createPreviewTunnelProxy({ adminOrigin });
  const proxyOrigin = await listen(proxy);
  t.after(() => close(proxy));

  const attempts = [
    fetch(`${proxyOrigin}/`),
    fetch(`${proxyOrigin}/articles`),
    fetch(`${proxyOrigin}/api/auth/session`),
    fetch(`${proxyOrigin}/api/preview/resolve`),
    fetch(`${proxyOrigin}/api/preview/resolve?token=unexpected`, {
      method: "POST",
    }),
  ];
  const responses = await Promise.all(attempts);

  assert.deepEqual(
    responses.map((response) => response.status),
    [404, 404, 404, 404, 404],
  );
  assert.equal(requests, 0);
});

test("retorna erro seguro quando o Admin está indisponível", async (t) => {
  const unavailable = createServer();
  const unavailableOrigin = await listen(unavailable);
  await close(unavailable);

  const proxy = createPreviewTunnelProxy({ adminOrigin: unavailableOrigin });
  const proxyOrigin = await listen(proxy);
  t.after(() => close(proxy));

  const response = await fetch(`${proxyOrigin}/api/preview/resolve`, {
    method: "POST",
    headers: { authorization: "Bearer token-that-must-not-be-logged" },
  });

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    error: "preview_proxy_unavailable",
  });
});

test("interrompe uma resolução que excede o timeout", async (t) => {
  const admin = createServer(() => undefined);
  const adminOrigin = await listen(admin);
  t.after(() => close(admin));

  const proxy = createPreviewTunnelProxy({
    adminOrigin,
    requestTimeoutMilliseconds: 30,
  });
  const proxyOrigin = await listen(proxy);
  t.after(() => close(proxy));

  const response = await fetch(`${proxyOrigin}/api/preview/resolve`, {
    method: "POST",
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "preview_proxy_unavailable",
  });
});
