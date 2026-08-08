import { expect, test } from "@playwright/test";

const authenticatedUser = {
  id: "user",
  email: "analyst@example.test",
  full_name: "Analista DataNexus",
  status: "active",
  roles: ["analyst"],
  permissions: [],
  must_change_password: false,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "AUTHENTICATION_REQUIRED", message: "Debes iniciar sesión." }),
      });
    }
    if (path.endsWith("/health")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", service: "datanexus-api" }),
      });
    }
    return route.fallback();
  });
});

test("shows a safe error for invalid credentials", async ({ page }) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        code: "INVALID_CREDENTIALS",
        message: "Las credenciales ingresadas no son válidas.",
      }),
    }),
  );

  await page.goto("/login");
  await page.getByLabel("Correo").fill("analyst@example.test");
  await page.getByRole("textbox", { name: /^Contraseña/ }).fill("incorrecta");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByRole("alert")).toContainText("No pudimos iniciar sesión");
  await expect(page).toHaveURL(/\/login$/);
});

test("authenticates and opens the existing dashboard", async ({ page }) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      email: "analyst@example.test",
      password: "valid-password",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticatedUser),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Correo").fill("analyst@example.test");
  await page.getByRole("textbox", { name: /^Contraseña/ }).fill("valid-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByRole("heading", { name: "Bienvenido a DataNexus" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
