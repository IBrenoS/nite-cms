import { expect, test } from "@playwright/test";

const staging = {
  baseUrl: process.env.ADMIN_E2E_BASE_URL,
  adminStorageState: process.env.ADMIN_E2E_ADMIN_STORAGE_STATE,
  publisherStorageState: process.env.ADMIN_E2E_PUBLISHER_STORAGE_STATE,
  articleId: process.env.ADMIN_E2E_ARTICLE_ID,
  invitationEmail: process.env.ADMIN_E2E_INVITATION_EMAIL,
};
const missing = Object.entries(staging)
  .filter(([name]) => name !== "invitationEmail")
  .filter(([, value]) => !value)
  .map(([name]) => name);

test.describe("CMS Admin — fluxos críticos em staging", () => {
  test.skip(
    missing.length > 0,
    `Requer staging real e variáveis explícitas: ${missing.join(", ")}.`,
  );

  test.describe("publisher", () => {
    test.use({ storageState: staging.publisherStorageState });

    test("não acessa memberships nem encontra controles administrativos", async ({
      page,
    }) => {
      await page.goto(staging.baseUrl);
      await expect(
        page.getByRole("link", { name: "Equipe e acessos" }),
      ).toHaveCount(0);
      await page.goto(`${staging.baseUrl}/memberships`);
      await expect(
        page.getByRole("heading", { name: "Acesso negado" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Criar convite" }),
      ).toHaveCount(0);
      await expect(page.getByLabel(/Nível de acesso de/)).toHaveCount(0);
    });
  });

  test.describe("admin", () => {
    test.use({ storageState: staging.adminStorageState });

    test("vê a superfície administrativa de memberships", async ({ page }) => {
      await page.goto(`${staging.baseUrl}/memberships`);
      await expect(
        page.getByRole("heading", { name: "Equipe e acessos" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Criar convite" }),
      ).toBeVisible();
    });

    test("cria, corrige e revoga um convite institucional", async ({
      page,
    }) => {
      test.skip(
        !staging.invitationEmail,
        "Requer ADMIN_E2E_INVITATION_EMAIL exclusivo para esta execução.",
      );
      const [localPart, domain] = staging.invitationEmail.split("@");
      const correctedEmail = `${localPart}+corrigido@${domain}`;
      await page.goto(`${staging.baseUrl}/memberships`);
      await page
        .getByLabel("E-mail institucional")
        .fill(staging.invitationEmail);
      await page.getByRole("button", { name: "Criar convite" }).click();

      let invitation = page.getByRole("listitem").filter({
        hasText: staging.invitationEmail,
      });
      await expect(invitation).toBeVisible();
      await invitation.getByRole("button", { name: "Corrigir" }).click();
      await invitation.getByLabel("E-mail institucional").fill(correctedEmail);
      await invitation
        .getByRole("button", { name: "Substituir convite" })
        .click();

      invitation = page
        .getByRole("listitem")
        .filter({ hasText: correctedEmail });
      await expect(invitation).toBeVisible();
      await invitation.getByRole("button", { name: "Revogar" }).click();
      await expect(invitation).toHaveCount(0);
    });

    test("explica pendências sem salto nativo ao publicar uma matéria nova", async ({
      page,
    }) => {
      await page.goto(`${staging.baseUrl}/articles/new`);
      await expect(page.getByRole("button", { name: "Arquivar" })).toHaveCount(
        0,
      );
      await expect(
        page.getByLabel("Texto alternativo da imagem inline"),
      ).not.toHaveAttribute("required", "");

      await page.getByRole("button", { name: "Publicar matéria" }).click();

      await expect(page.getByRole("alert").first()).toContainText(
        "Revise os campos destacados.",
      );
      await expect(page.getByLabel("Título")).toBeFocused();
    });

    test("confirma lifecycle para o artigo de staging explicitamente informado", async ({
      page,
    }) => {
      await page.goto(`${staging.baseUrl}/articles/${staging.articleId}/edit`);
      await expect(
        page.getByRole("button", { name: "Arquivar" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Arquivar" }).click();
      const dialog = page.getByRole("dialog", { name: "Arquivar matéria?" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(/arquiv|ciclo de vida/i);
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog).toHaveCount(0);
    });
  });
});
