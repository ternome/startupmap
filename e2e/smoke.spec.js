import { expect, test } from '@playwright/test';

test('desktop discovery, profile, deep link, filter, and submission flows', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /find ambitious companies/i })).toBeVisible();
  await expect(page.locator('.startup-card')).toHaveCount(27);
  await page.screenshot({ path: '/tmp/startupmap-desktop.png', fullPage: true });

  await page.getByRole('searchbox', { name: 'Search startups' }).fill('Bengaluru');
  await expect(page.locator('.startup-card')).toHaveCount(2);
  await expect(page.getByText('2 startups', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();

  await page.getByRole('button', { name: /Open Mistral AI/ }).click();
  await expect(page.getByRole('dialog', { name: 'Mistral AI' })).toBeVisible();
  await expect(page).toHaveURL(/\?startup=mistral-ai$/);
  await expect(page.getByText('September 17, 2026')).toBeVisible();
  await page.getByRole('button', { name: 'Close startup profile' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/?startup=canva');
  await expect(page.getByRole('dialog', { name: 'Canva' })).toBeVisible();
  await page.getByRole('button', { name: 'Close startup profile' }).click();

  await page.getByRole('button', { name: 'Add a startup' }).click();
  await expect(page.getByRole('dialog', { name: 'Suggest a startup' })).toBeVisible();
  await expect(page.getByText(/prepares a public GitHub issue/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close submission form' }).click();

  expect(errors).toEqual([]);
});

test('mobile layout keeps discovery and profile usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search startups' })).toBeVisible();
  await page.locator('#sector-filter').selectOption('Mobility');
  await expect(page.getByText('4 startups', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open Careem/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Careem' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('width', '390px');
  await expect(page.getByRole('link', { name: /Visit Careem website/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/startupmap-mobile-profile.png' });
});

test('the map and list remain usable without external network requests', async ({ page }) => {
  await page.route('https://**', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.startup-card')).toHaveCount(27);
  await expect(page.locator('.leaflet-basemap-pane path').first()).toBeVisible();
  await expect(page.locator('.marker-cluster').first()).toBeVisible();
});
