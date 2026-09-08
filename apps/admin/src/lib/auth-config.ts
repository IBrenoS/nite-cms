import { z } from "zod";

import { CmsAuthorizationError, type EntraIdentity } from "@nite/editorial";

const requiredConfiguration = {
  DATABASE_ADMIN_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_TENANT_ID: z.uuid(),
  CMS_BOOTSTRAP_ADMIN_OID: z.uuid(),
} as const;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export type AdminConfiguration = {
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  microsoftClientId: string;
  microsoftClientSecret: string;
  tenantId: string;
  bootstrapAdminObjectId: string;
};

export type AdminConfigurationResult =
  | { configured: false; missing: string[] }
  | { configured: true; configuration: AdminConfiguration };

export function readAdminConfiguration(
  environment: EnvironmentSource,
): AdminConfigurationResult {
  const missing = Object.entries(requiredConfiguration)
    .filter(([name, schema]) => !schema.safeParse(environment[name]).success)
    .map(([name]) => name);

  if (missing.length > 0) {
    return { configured: false, missing };
  }

  return {
    configured: true,
    configuration: {
      databaseUrl: environment.DATABASE_ADMIN_URL!,
      betterAuthSecret: environment.BETTER_AUTH_SECRET!,
      betterAuthUrl: environment.BETTER_AUTH_URL!,
      microsoftClientId: environment.MICROSOFT_CLIENT_ID!,
      microsoftClientSecret: environment.MICROSOFT_CLIENT_SECRET!,
      tenantId: environment.MICROSOFT_TENANT_ID!,
      bootstrapAdminObjectId: environment.CMS_BOOTSTRAP_ADMIN_OID!,
    },
  };
}

export function toEntraIdentity(
  configuration: Pick<
    AdminConfiguration,
    "tenantId" | "bootstrapAdminObjectId"
  >,
  account: { accountId: string; providerId: string; issuer: string },
  user: { name: string; email: string },
): EntraIdentity {
  const expectedIssuer = `https://login.microsoftonline.com/${configuration.tenantId}/v2.0`;
  if (
    account.providerId !== "microsoft" ||
    !z.uuid().safeParse(account.accountId).success ||
    account.issuer !== expectedIssuer
  ) {
    throw new CmsAuthorizationError();
  }

  return {
    tenantId: configuration.tenantId,
    objectId: account.accountId,
    displayName: user.name,
    email: user.email,
  };
}
