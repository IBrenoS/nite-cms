import { describe, expect, it } from "vitest";
import {
  CmsAuthorizationError,
  CmsMembershipManagementError,
} from "@nite/editorial";
import { z } from "zod";

import { membershipActionError } from "./membership-errors";

describe("erros públicos de memberships", () => {
  it("não vaza mensagens do domínio, banco ou driver", () => {
    expect(membershipActionError(new z.ZodError([]))).toBe(
      "Revise os dados da membership.",
    );
    expect(membershipActionError(new CmsAuthorizationError())).toBe(
      "Você não tem permissão para administrar memberships.",
    );
    expect(
      membershipActionError(
        new CmsMembershipManagementError("último admin ativo"),
      ),
    ).toBe("A alteração viola as regras de administração de memberships.");
    expect(
      membershipActionError(
        new Error(
          'duplicate key value violates unique constraint "cms_memberships"',
        ),
      ),
    ).toBe("Não foi possível atualizar memberships.");
  });
});
