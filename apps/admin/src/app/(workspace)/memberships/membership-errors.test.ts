import { describe, expect, it } from "vitest";
import {
  CmsAuthorizationError,
  CmsMembershipManagementError,
} from "@nite/editorial";
import { z } from "zod";

import { membershipActionError } from "./membership-errors";

describe("erros públicos de equipe e acessos", () => {
  it("não vaza mensagens do domínio, banco ou driver", () => {
    expect(membershipActionError(new z.ZodError([]))).toBe(
      "Revise os dados do convite ou acesso.",
    );
    expect(membershipActionError(new CmsAuthorizationError())).toBe(
      "Você não tem permissão para administrar a equipe.",
    );
    expect(
      membershipActionError(
        new CmsMembershipManagementError("último admin ativo"),
      ),
    ).toBe("A alteração viola as regras de administração da equipe.");
    expect(
      membershipActionError(
        new Error(
          'duplicate key value violates unique constraint "cms_memberships"',
        ),
      ),
    ).toBe("Não foi possível atualizar a equipe e os acessos.");
  });
});
