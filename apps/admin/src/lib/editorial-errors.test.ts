import { describe, expect, it, vi } from "vitest";

import {
  CmsAuthorizationError,
  EditorialSlugConflictError,
  MediaQuarantinedError,
} from "@nite/editorial";

import { editorialActionFailure } from "./editorial-errors";

describe("erros de ações editoriais", () => {
  it("associa colisão de slug ao campo correspondente", () => {
    expect(
      editorialActionFailure(new EditorialSlugConflictError(), "save"),
    ).toEqual({
      status: "validation_error",
      message: "Revise os campos destacados.",
      fieldErrors: { slug: ["Já existe uma matéria com este slug."] },
    });
  });

  it("diferencia autorização e quarentena de mídia", () => {
    expect(
      editorialActionFailure(new CmsAuthorizationError(), "publish"),
    ).toMatchObject({ status: "forbidden" });
    expect(
      editorialActionFailure(new MediaQuarantinedError(), "media"),
    ).toMatchObject({
      status: "operation_error",
      code: "media_quarantined",
      retryable: false,
    });
  });

  it("não expõe falha inesperada e registra um identificador rastreável", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = editorialActionFailure(
      new Error('duplicate key value "conteúdo privado"'),
      "save",
    );

    expect(failure).toMatchObject({
      status: "unexpected_error",
      message: "Não foi possível concluir a operação editorial.",
    });
    expect(failure).toHaveProperty("errorId");
    expect(JSON.stringify(failure)).not.toContain("conteúdo privado");
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain("conteúdo privado");
    log.mockRestore();
  });
});
