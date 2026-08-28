import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";

import {
  CmsAuthorizationError,
  account,
  resolveCmsMembership,
} from "@nite/content/admin";
import * as cmsSchema from "@nite/content/admin";
import {
  type AdminConfiguration,
  readAdminConfiguration,
  toEntraIdentity,
} from "./auth-config";
import { getCmsDatabase } from "./database";

function createAuth(configuration: AdminConfiguration) {
  const database = getCmsDatabase(configuration);
  return betterAuth({
    appName: "NITE CMS",
    baseURL: configuration.betterAuthUrl,
    secret: configuration.betterAuthSecret,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: cmsSchema,
      transaction: true,
    }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      microsoft: {
        clientId: configuration.microsoftClientId,
        clientSecret: configuration.microsoftClientSecret,
        tenantId: configuration.tenantId,
        disableProfilePhoto: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
    },
    trustedOrigins: [configuration.betterAuthUrl],
    advanced: {
      cookiePrefix: "nite-cms",
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | undefined;

export function getAuth(configuration: AdminConfiguration): AuthInstance {
  if (authInstance) return authInstance;
  authInstance = createAuth(configuration);
  return authInstance;
}

export async function getCmsContext() {
  const configurationResult = readAdminConfiguration(process.env);
  if (!configurationResult.configured) {
    return {
      status: "unconfigured" as const,
      missing: configurationResult.missing,
    };
  }

  const configuration = configurationResult.configuration;
  const auth = getAuth(configuration);
  const authSession = await auth.api.getSession({ headers: await headers() });
  if (!authSession) return { status: "anonymous" as const };

  const database = getCmsDatabase(configuration);
  const [microsoftAccount] = await database
    .select({ accountId: account.accountId, providerId: account.providerId })
    .from(account)
    .where(
      and(
        eq(account.userId, authSession.user.id),
        eq(account.providerId, "microsoft"),
      ),
    )
    .limit(1);
  if (!microsoftAccount || microsoftAccount.providerId !== "microsoft") {
    return { status: "forbidden" as const };
  }

  try {
    const membership = await resolveCmsMembership(
      database,
      toEntraIdentity(configuration, microsoftAccount, authSession.user),
      {
        tenantId: configuration.tenantId,
        adminObjectId: configuration.bootstrapAdminObjectId,
      },
    );
    return {
      status: "authenticated" as const,
      authSession,
      membership,
      configuration,
      database,
    };
  } catch (error) {
    if (error instanceof CmsAuthorizationError) {
      return { status: "forbidden" as const };
    }
    throw error;
  }
}

export async function requireCmsContext() {
  const context = await getCmsContext();
  if (context.status !== "authenticated") {
    throw new CmsAuthorizationError();
  }
  return context;
}

export async function requireCmsPageContext() {
  const context = await getCmsContext();
  if (context.status !== "authenticated") {
    redirect("/login");
  }
  return context;
}
