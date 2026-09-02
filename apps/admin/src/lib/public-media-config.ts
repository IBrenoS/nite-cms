type EnvironmentSource = Readonly<Record<string, string | undefined>>;

type PublicMediaRemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port: string;
  pathname: string;
  search: "";
};

type PublicMediaConfigurationResult =
  | { configured: false }
  | {
      configured: true;
      baseUrl: string;
      remotePattern: PublicMediaRemotePattern;
    };

function invalidPublicMediaConfiguration(): never {
  throw new Error("Configuração inválida: R2_PUBLIC_BASE_URL.");
}

export function readPublicMediaConfiguration(
  environment: EnvironmentSource,
): PublicMediaConfigurationResult {
  const input = environment.R2_PUBLIC_BASE_URL?.trim();
  if (!input) return { configured: false };

  let baseUrl: URL;
  try {
    baseUrl = new URL(input);
  } catch {
    invalidPublicMediaConfiguration();
  }

  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    invalidPublicMediaConfiguration();
  }

  const protocol = baseUrl.protocol === "http:" ? "http" : "https";
  const pathPrefix = baseUrl.pathname.replace(/\/+$/, "");
  baseUrl.pathname = `${pathPrefix}/`;

  return {
    configured: true,
    baseUrl: baseUrl.toString(),
    remotePattern: {
      protocol,
      hostname: baseUrl.hostname,
      port: baseUrl.port,
      pathname: `${pathPrefix}/**`,
      search: "",
    },
  };
}
