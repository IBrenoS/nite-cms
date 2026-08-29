import {
  CmsAuthorizationError,
  CmsMembershipManagementError,
} from "@nite/editorial";
import { z } from "zod";

export function membershipActionError(error: unknown) {
  if (error instanceof z.ZodError) return "Revise os dados da membership.";
  if (error instanceof CmsAuthorizationError) {
    return "Você não tem permissão para administrar memberships.";
  }
  if (error instanceof CmsMembershipManagementError) {
    return "A alteração viola as regras de administração de memberships.";
  }
  return "Não foi possível atualizar memberships.";
}
