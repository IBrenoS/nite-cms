"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  changeCmsMembershipRole,
  createCmsMembershipInvitation,
  replaceCmsMembershipInvitation,
  revokeCmsMembershipInvitation,
  setCmsMembershipActive,
} from "@nite/editorial";
import { requireCmsContext } from "@/lib/auth";
import { membershipActionError } from "./membership-errors";

const invitationInputSchema = z.object({
  email: z.string().trim().min(1).max(320),
  role: z.enum(["admin", "publisher"]),
});
const invitationReferenceSchema = z.object({ invitationId: z.uuid() });
const membershipChangeSchema = z.object({
  objectId: z.string().trim().min(1).max(128),
  role: z.enum(["admin", "publisher"]),
});
const membershipActiveSchema = z.object({
  objectId: z.string().trim().min(1).max(128),
  active: z.boolean(),
});

export type MembershipActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function failure(error: unknown): MembershipActionState {
  return {
    status: "error",
    message: membershipActionError(error),
  };
}

export async function createMembershipInvitation(
  _previous: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  try {
    const context = await requireCmsContext();
    const input = invitationInputSchema.parse({
      email: formData.get("email"),
      role: formData.get("role"),
    });
    await createCmsMembershipInvitation(context.database, {
      actor: context.membership,
      ...input,
    });
    revalidatePath("/memberships");
    return { status: "success", message: "Convite criado por 7 dias." };
  } catch (error) {
    return failure(error);
  }
}

export async function replaceMembershipInvitation(input: unknown) {
  try {
    const context = await requireCmsContext();
    const parsed = invitationInputSchema
      .and(invitationReferenceSchema)
      .parse(input);
    await replaceCmsMembershipInvitation(context.database, {
      actor: context.membership,
      ...parsed,
    });
    revalidatePath("/memberships");
    return { status: "success" as const };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeMembershipInvitation(input: unknown) {
  try {
    const context = await requireCmsContext();
    const parsed = invitationReferenceSchema.parse(input);
    await revokeCmsMembershipInvitation(context.database, {
      actor: context.membership,
      ...parsed,
    });
    revalidatePath("/memberships");
    return { status: "success" as const };
  } catch (error) {
    return failure(error);
  }
}

export async function updateMembershipRole(input: unknown) {
  try {
    const context = await requireCmsContext();
    const parsed = membershipChangeSchema.parse(input);
    await changeCmsMembershipRole(context.database, {
      actor: context.membership,
      tenantId: context.membership.tenantId,
      ...parsed,
    });
    revalidatePath("/memberships");
    return { status: "success" as const };
  } catch (error) {
    return failure(error);
  }
}

export async function updateMembershipActive(input: unknown) {
  try {
    const context = await requireCmsContext();
    const parsed = membershipActiveSchema.parse(input);
    await setCmsMembershipActive(context.database, {
      actor: context.membership,
      tenantId: context.membership.tenantId,
      ...parsed,
    });
    revalidatePath("/memberships");
    return { status: "success" as const };
  } catch (error) {
    return failure(error);
  }
}
