import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dispatchOutbox,
  readSchedulerConfiguration,
  runOutboxScheduler,
} from "./outbox-scheduler.mjs";

const secret = "s".repeat(32);
const endpointUrl = "http://admin:3001/api/cron/outbox";

describe("outbox scheduler", () => {
  it("aplica o intervalo padrão de quinze minutos e timeout de setenta segundos", () => {
    assert.deepEqual(
      readSchedulerConfiguration({
        CMS_OUTBOX_URL: endpointUrl,
        CRON_SECRET: secret,
      }),
      {
        endpointUrl,
        secret,
        intervalMs: 900_000,
        timeoutMs: 70_000,
      },
    );
  });

  it("rejeita endpoint, secret e intervalo inseguros", () => {
    assert.throws(
      () => readSchedulerConfiguration({ CRON_SECRET: secret }),
      /CMS_OUTBOX_URL/,
    );
    assert.throws(
      () =>
        readSchedulerConfiguration({
          CMS_OUTBOX_URL: "file:///tmp/outbox",
          CRON_SECRET: secret,
        }),
      /CMS_OUTBOX_URL/,
    );
    assert.throws(
      () =>
        readSchedulerConfiguration({
          CMS_OUTBOX_URL: endpointUrl,
          CRON_SECRET: "curto",
        }),
      /CRON_SECRET/,
    );
    assert.throws(
      () =>
        readSchedulerConfiguration({
          CMS_OUTBOX_URL: endpointUrl,
          CRON_SECRET: secret,
          OUTBOX_INTERVAL_MS: "59999",
        }),
      /OUTBOX_INTERVAL_MS/,
    );
  });

  it("envia somente o bearer necessário e aceita resposta sem ler o corpo", async () => {
    let observed;
    const fetcher = async (url, init) => {
      observed = { url, init };
      return new Response("conteúdo que não deve ser registrado", {
        status: 200,
      });
    };

    await dispatchOutbox({ endpointUrl, secret, timeoutMs: 1000, fetcher });

    assert.equal(observed.url, endpointUrl);
    assert.equal(observed.init.method, "GET");
    assert.equal(observed.init.headers.Authorization, `Bearer ${secret}`);
    assert.equal(observed.init.redirect, "error");
  });

  it("falha por status sem incluir secret ou corpo na mensagem", async () => {
    const failure = await dispatchOutbox({
      endpointUrl,
      secret,
      timeoutMs: 1000,
      fetcher: async () =>
        new Response("payload-editorial-sensível", { status: 503 }),
    }).catch((error) => error);

    assert.match(failure.message, /503/);
    assert.doesNotMatch(failure.message, /payload-editorial|ssss/);
  });

  it("cancela requisições que excedem o timeout", async () => {
    const fetcher = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          {
            once: true,
          },
        );
      });

    await assert.rejects(
      dispatchOutbox({ endpointUrl, secret, timeoutMs: 5, fetcher }),
      /timeout/i,
    );
  });

  it("executa imediatamente e nunca sobrepõe chamadas", async () => {
    const controller = new AbortController();
    let calls = 0;
    let active = 0;
    let maximumActive = 0;
    const events = [];

    await runOutboxScheduler({
      configuration: {
        endpointUrl,
        secret,
        intervalMs: 60_000,
        timeoutMs: 1000,
      },
      signal: controller.signal,
      fetcher: async () => {
        calls += 1;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        active -= 1;
        if (calls === 2) controller.abort();
        return new Response(null, { status: 200 });
      },
      sleep: async () => undefined,
      log: (event) => events.push(event),
    });

    assert.equal(calls, 2);
    assert.equal(maximumActive, 1);
    assert.deepEqual(
      events.map(({ event }) => event),
      ["outbox_dispatch_succeeded", "outbox_dispatch_succeeded"],
    );
    assert.doesNotMatch(JSON.stringify(events), new RegExp(secret));
  });
});
