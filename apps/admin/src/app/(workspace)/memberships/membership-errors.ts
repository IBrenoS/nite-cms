import {
  CmsAuthorizationError,
  CmsMembershipInvitationError,
  CmsMembershipManagementError,
} from "@nite/editorial";
import { z } from "zod";

export function membershipActionError(error: unknown) {
  if (error instanceof z.ZodError)
    return "Revise os dados do convite ou acesso.";
  if (error instanceof CmsAuthorizationError) {
    return "Você não tem permissão para administrar a equipe.";
  }
  if (error instanceof CmsMembershipInvitationError) {
    if (error.code === "duplicate")
      return "Já existe um convite pendente para este e-mail.";
    if (error.code === "member_exists")
      return "Este e-mail já pertence a uma pessoa da equipe.";
    if (error.code === "no_change")
      return "Altere o e-mail ou o nível de acesso para corrigir o convite.";
    return "O convite não está mais disponível para esta alteração.";
  }
  if (error instanceof CmsMembershipManagementError) {
    return "A alteração viola as regras de administração da equipe.";
  }
  return "Não foi possível atualizar a equipe e os acessos.";
}
