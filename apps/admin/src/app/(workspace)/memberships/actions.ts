"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  changeCmsMembershipRole,
  createCmsMembership,
  setCmsMembershipActive,
} from "@nite/editorial";
import { requireCmsContext } from "@/lib/auth";

const membershipInputSchema = z.object({
  objectId: z.string().trim().min(1).max(128),
  displayName: z.string().trim().min(1).max(160),
  email: z.email().max(320).optional(),
  role: z.enum(["admin", "publisher"]),
});
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
  if (error instanceof z.ZodError) {
    return { status: "error", message: "Revise os dados da membership." };
  }
  if (error instanceof Error)
    return { status: "error", message: error.message };
  return {
    status: "error",
    message: "Não foi possível atualizar memberships.",
  };
}

export async function createMembership(
  _previous: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  try {
    const context = await requireCmsContext();
    const input = membershipInputSchema.parse({
      objectId: formData.get("objectId"),
      displayName: formData.get("displayName"),
      email: formData.get("email") || undefined,
      role: formData.get("role"),
    });
    await createCmsMembership(context.database, {
      actor: context.membership,
      identity: { ...input, tenantId: context.membership.tenantId },
      role: input.role,
    });
    revalidatePath("/memberships");
    return { status: "success", message: "Membership criada e ativada." };
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
