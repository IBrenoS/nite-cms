import { expect, test } from "@playwright/test";

const staging = {
  baseUrl: process.env.ADMIN_E2E_BASE_URL,
  adminStorageState: process.env.ADMIN_E2E_ADMIN_STORAGE_STATE,
  publisherStorageState: process.env.ADMIN_E2E_PUBLISHER_STORAGE_STATE,
  articleId: process.env.ADMIN_E2E_ARTICLE_ID,
};
const missing = Object.entries(staging)
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
      await page.goto(`${staging.baseUrl}/memberships`);
      await expect(
        page.getByRole("heading", { name: "Acesso negado" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Criar e ativar/ }),
      ).toHaveCount(0);
      await expect(page.getByLabel(/Papel de/)).toHaveCount(0);
    });
  });

  test.describe("admin", () => {
    test.use({ storageState: staging.adminStorageState });

    test("vê a superfície administrativa de memberships", async ({ page }) => {
      await page.goto(`${staging.baseUrl}/memberships`);
      await expect(
        page.getByRole("heading", { name: "Memberships" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Criar e ativar/ }),
      ).toBeVisible();
    });

    test("confirma lifecycle para o artigo de staging explicitamente informado", async ({
      page,
    }) => {
      await page.goto(`${staging.baseUrl}/articles/${staging.articleId}/edit`);
      await expect(
        page.getByRole("button", { name: "Arquivar" }),
      ).toBeVisible();
      const [dialog] = await Promise.all([
        page.waitForEvent("dialog"),
        page.getByRole("button", { name: "Arquivar" }).click(),
      ]);
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toMatch(/arquiv|ciclo de vida/i);
      await dialog.dismiss();
    });
  });
});
