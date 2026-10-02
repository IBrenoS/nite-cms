import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";

import {
  cmsMembershipInvitations,
  cmsMemberships,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";
import { createInvitationSignature } from "./invitation-link";
import {
  decodeInvitationAcceptanceCookie,
  encodeInvitationAcceptanceCookie,
  validateInvitationAcceptance,
} from "./invitation-acceptance";

const migrationsFolder = path.resolve(process.cwd(), "../../packages/db/drizzle");
const secret = "convite-secreto-com-pelo-menos-32-bytes";

describe("contexto de aceite do convite", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("codifica a referência sem perder integridade estrutural", () => {
    const reference = {
      invitationId: "10000000-0000-4000-8000-000000000001",
      signature: "a".repeat(43),
    };
    expect(
      decodeInvitationAcceptanceCookie(
        encodeInvitationAcceptanceCookie(reference),
      ),
    ).toEqual(reference);
    expect(decodeInvitationAcceptanceCookie("conteudo-adulterado")).toBeUndefined();
  });

  it("valida assinatura, estado e expiração sem consumir o convite", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "10000000-0000-4000-8000-000000000001",
        objectId: "20000000-0000-4000-8000-000000000001",
        displayName: "Breno NITE",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId: admin.tenantId,
        email: "pessoa@unijorge.com.br",
        role: "publisher",
        invitedByMembershipId: admin.id,
        expiresAt: new Date("2026-10-09T12:00:00.000Z"),
      })
      .returning();
    const signature = createInvitationSignature(
      {
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        linkNonce: invitation.linkNonce,
        expiresAt: invitation.expiresAt,
      },
      secret,
    );

    await expect(
      validateInvitationAcceptance(
        database,
        { invitationId: invitation.id, signature },
        secret,
        new Date("2026-10-02T12:00:00.000Z"),
      ),
    ).resolves.toEqual({
      status: "valid",
      invitation: {
        id: invitation.id,
        expiresAt: invitation.expiresAt,
        inviterDisplayName: "Breno NITE",
      },
    });
    await expect(
      validateInvitationAcceptance(
        database,
        { invitationId: invitation.id, signature: "b".repeat(43) },
        secret,
      ),
    ).resolves.toEqual({ status: "invalid" });
    await expect(
      validateInvitationAcceptance(
        database,
        { invitationId: invitation.id, signature },
        secret,
        invitation.expiresAt,
      ),
    ).resolves.toEqual({ status: "expired" });

    const [persisted] = await database.select().from(cmsMembershipInvitations);
    expect(persisted).toMatchObject({ status: "pending", acceptedAt: null });
    await expect(database.select().from(cmsMemberships)).resolves.toHaveLength(
      1,
    );
  });
});
