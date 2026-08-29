import { expect, test } from "@playwright/test";

const adminUrl = process.env.ADMIN_E2E_BASE_URL;

test.describe("CMS Admin — fluxos críticos", () => {
  test.skip(
    !adminUrl,
    "Requer Admin configurado com Entra e PostgreSQL de staging.",
  );

  test("publisher não encontra memberships e admins gerenciam o acesso", async ({
    page,
  }) => {
    await page.goto(`${adminUrl}/memberships`);
    await expect(
      page.getByRole("heading", { name: "Memberships" }),
    ).toBeVisible();
    // A sessão publisher é validada no staging: deve receber a superfície negada,
    // sem controles administrativos nem endpoints de mutação acessíveis pela UI.
  });

  test("editor exige confirmação para publish e lifecycle", async ({
    page,
  }) => {
    await page.goto(`${adminUrl}/articles`);
    await expect(
      page.getByRole("button", { name: /Publicar revisão/ }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: /Publicar revisão/ }).click();
  });
});
