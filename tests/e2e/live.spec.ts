import { expect, test } from '@playwright/test';
import { mockApis, trackErrors } from './mocks';

test('Mundial: ronda con APIs simuladas, atribución de foto y cabecera de Wikimedia', async ({ page }) => {
  const errors = trackErrors(page);
  const log = await mockApis(page);
  await page.goto('/');
  await page.getByText('Mundial', { exact: true }).click();
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await expect(page.locator('.card img').first()).toBeVisible();
  // Elige una válida (Helecho 1 es local y nativa).
  await page.locator('.card', { has: page.locator('.card-name', { hasText: /^Helecho 1$/ }) }).click();
  await page.locator('#btn-confirm').click();
  await expect(page.locator('.sheet-verdict')).toContainText('Vive aquí');
  await expect(page.locator('.specimen-mount figcaption')).toContainText('(c) Ana Botánica');
  await expect(page.locator('.specimen-mount figcaption')).toContainText('CC BY');
  await expect(page.locator('[data-extract]')).toContainText('Helecho de sotobosque');
  await expect(page.locator('.leaflet-control-attribution')).toContainText('Esri');
  // Las visitas llegan: hay fichas con rareza distinta de «Común».
  await expect(page.locator('.sheet-facts')).toContainText('al año');

  const wm = log.wikimedia.filter((w) => !w.url.includes('OPTIONS'));
  expect(wm.length).toBeGreaterThan(0);
  for (const w of wm) expect(w.apiUserAgent).toMatch(/^FloraGuessr\//);
  expect(log.inat.some((u) => u.includes('order_by=random'))).toBe(false);
  expect(errors).toEqual([]);
});

test('Mundial: precarga la ronda siguiente mientras se juega', async ({ page }) => {
  await mockApis(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await page.waitForTimeout(16_000); // tiempo de juego: la cola a 30/min termina la precarga
  await page.locator('.card').first().click();
  await page.locator('#btn-confirm').click();
  await page.locator('.sheet [data-act="next"]').click();
  const t0 = Date.now();
  await expect(page.locator('.card')).toHaveCount(6);
  expect(Date.now() - t0).toBeLessThan(2000);
});

test('se recupera de un 429 con Retry-After', async ({ page }) => {
  const errors = trackErrors(page);
  await mockApis(page, { first429: true });
  await page.goto('/');
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  await expect(page.locator('.card')).toHaveCount(6, { timeout: 30_000 });
  // El 429 simulado aparece en consola como recurso fallido; no debe haber errores de la app.
  expect(errors.filter((e) => !e.includes('429'))).toEqual([]);
});

test('sin respuesta de iNaturalist muestra el error y permite reintentar', async ({ page }) => {
  await mockApis(page, { inatStatus: 500 });
  await page.goto('/');
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  await expect(page.getByRole('heading', { name: /el mapa se ha quedado en blanco|Los registros no contestan/ })).toBeVisible({ timeout: 80_000 });
  await expect(page.getByRole('button', { name: 'Volver a intentarlo' })).toBeVisible();
});

test('Equilibrado: base cerrada y lugar real de una de las cartas', async ({ page }) => {
  const errors = trackErrors(page);
  await mockApis(page);
  await page.goto('/');
  await page.getByText('Equilibrado', { exact: true }).click();
  await expect(page.locator('#difficulty')).toBeHidden();
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  await expect(page.locator('.card')).toHaveCount(6, { timeout: 30_000 });
  const groups = await page.locator('.card-group').allTextContents();
  expect(new Set(groups).size).toBeGreaterThanOrEqual(5);
  await page.locator('#btn-surrender').click();
  await expect(page.locator('.sheet-verdict')).toBeVisible();
  expect(errors.filter((e) => !e.includes('Failed to load resource'))).toEqual([]);
});
