import { pathToFileURL } from "node:url";

const DEFAULT_INTERVAL_MS = 900_000;
const REQUEST_TIMEOUT_MS = 70_000;
const MINIMUM_INTERVAL_MS = 60_000;
const MAXIMUM_INTERVAL_MS = 86_400_000;

function readPositiveInteger(value, variableName, fallback) {
  const parsedValue = value === undefined ? fallback : Number(value);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${variableName} deve ser um número inteiro positivo.`);
  }

  return parsedValue;
}

export function readSchedulerConfiguration(environment = process.env) {
  const endpointUrl = environment.CMS_OUTBOX_URL;
  const secret = environment.CRON_SECRET;

  if (!endpointUrl) {
    throw new Error("CMS_OUTBOX_URL é obrigatória.");
  }

  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(endpointUrl);
  } catch {
    throw new Error("CMS_OUTBOX_URL deve ser uma URL HTTP válida.");
  }

  if (
    !["http:", "https:"].includes(parsedEndpoint.protocol) ||
    parsedEndpoint.username ||
    parsedEndpoint.password
  ) {
    throw new Error("CMS_OUTBOX_URL deve ser uma URL HTTP sem credenciais.");
  }

  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("CRON_SECRET deve ter pelo menos 32 caracteres.");
  }

  const intervalMs = readPositiveInteger(
    environment.OUTBOX_INTERVAL_MS,
    "OUTBOX_INTERVAL_MS",
    DEFAULT_INTERVAL_MS,
  );

  if (intervalMs < MINIMUM_INTERVAL_MS || intervalMs > MAXIMUM_INTERVAL_MS) {
    throw new Error(
      `OUTBOX_INTERVAL_MS deve estar entre ${MINIMUM_INTERVAL_MS} e ${MAXIMUM_INTERVAL_MS}.`,
    );
  }

  return {
    endpointUrl,
    secret,
    intervalMs,
    timeoutMs: REQUEST_TIMEOUT_MS,
  };
}

export async function dispatchOutbox({
  endpointUrl,
  secret,
  timeoutMs,
  fetcher = fetch,
}) {
  const response = await fetcher(endpointUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Outbox respondeu com status ${response.status}.`);
  }

  return response.status;
}

function waitForNextRun(durationMs, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(finish, durationMs);

    function finish() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function runOutboxScheduler({
  configuration,
  signal,
  fetcher = fetch,
  sleep = waitForNextRun,
  log = () => undefined,
}) {
  while (!signal.aborted) {
    try {
      const status = await dispatchOutbox({
        endpointUrl: configuration.endpointUrl,
        secret: configuration.secret,
        timeoutMs: configuration.timeoutMs,
        fetcher,
      });
      log({ event: "outbox_dispatch_succeeded", status });
    } catch (error) {
      if (!signal.aborted) {
        log({
          event: "outbox_dispatch_failed",
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }

    if (!signal.aborted) {
      await sleep(configuration.intervalMs, signal);
    }
  }
}

function writeLog(event) {
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`,
  );
}

async function main() {
  let configuration;
  try {
    configuration = readSchedulerConfiguration();
  } catch (error) {
    writeLog({
      event: "scheduler_configuration_failed",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await runOutboxScheduler({
    configuration,
    signal: controller.signal,
    log: writeLog,
  });
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await main();
}
