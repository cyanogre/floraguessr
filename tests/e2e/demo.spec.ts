import { expect, test } from '@playwright/test';
import { trackErrors } from './mocks';

test('partida de muestra completa sin errores', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?muestra');
  await expect(page.getByRole('heading', { name: 'FloraGuessr' })).toBeVisible();
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  for (let round = 1; round <= 5; round++) {
    await expect(page.locator('.card')).toHaveCount(6);
    await page.locator('.card').first().click();
    await page.locator('#btn-confirm').click();
    await expect(page.locator('#sheet')).toBeVisible();
    await expect(page.locator('.sheet-verdict')).toBeVisible();
    await page.locator('.sheet [data-act="next"]').click();
  }
  await expect(page.getByRole('heading', { name: 'Cuaderno completo' })).toBeVisible();
  await expect(page.locator('.ledger tbody tr')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('teclado: número para elegir, Enter para confirmar, Escape minimiza la ficha', async ({ page }) => {
  await page.goto('/?muestra');
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await page.keyboard.press('3');
  await expect(page.locator('.card').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.card').nth(2)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheetbar')).toBeVisible();
  await page.getByRole('button', { name: 'Ver la ficha' }).click();
  await expect(page.locator('#sheet')).toBeVisible();
});

test('pista, otro sobre y volver a la portada con confirmación', async ({ page }) => {
  await page.goto('/?muestra');
  await page.getByRole('button', { name: /Salir al campo/ }).click();
  await expect(page.locator('.card')).toHaveCount(6);
  await page.locator('#btn-hint').click();
  await expect(page.locator('.card.is-struck')).toHaveCount(2);
  await expect(page.locator('#btn-hint')).toBeDisabled();
  await page.locator('#btn-reroll').click();
  await expect(page.locator('.card.is-struck')).toHaveCount(0);
  await expect(page.locator('#btn-reroll .tool-count')).toHaveText('1');
  await page.locator('#btn-menu').click();
  await expect(page.getByRole('heading', { name: '¿Volver a la portada?' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a la portada' }).click();
  await expect(page.locator('#menu')).toBeVisible();
});
