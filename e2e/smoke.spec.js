import { expect, test } from '@playwright/test';

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function expectNoDocumentOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: globalThis.innerWidth,
    innerHeight: globalThis.innerHeight,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
    scrollHeight: globalThis.document.documentElement.scrollHeight,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.innerWidth);
  expect(dimensions.scrollHeight).toBe(dimensions.innerHeight);
}

test('desktop map workspace, discovery, profile, deep link, and submission flows', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Explore startups through place' })).toBeAttached();
  await expect(page.locator('#startup-total')).toHaveText('27');
  await expect(page.locator('#country-total')).toHaveText('18');
  await expect(page.locator('#region-total')).toHaveText('8');
  await expect(page.locator('.startup-card')).toHaveCount(27);
  await expect(page.locator('.leaflet-basemap-pane path').first()).toBeVisible();
  await expect(page.locator('.discovery-panel')).toBeVisible();
  await expect(page.locator('.intel-panel')).toBeVisible();
  await expectNoDocumentOverflow(page);

  const mapBox = await page.locator('#map').boundingBox();
  expect(mapBox).toMatchObject({ x: 0, y: 62, width: 1440, height: 838 });
  await page.screenshot({ path: '/tmp/startupmap-desktop.png' });

  await page.getByRole('searchbox', { name: 'Search startups' }).fill('Bengaluru');
  await expect(page.locator('.startup-card')).toHaveCount(2);
  await expect(page.getByText('2 startups', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();

  const mistralButton = page.getByRole('button', { name: /Open Mistral AI/ });
  await mistralButton.click();
  const profile = page.getByRole('dialog', { name: 'Mistral AI' });
  await expect(profile).toBeVisible();
  await expect(page).toHaveURL(/\?startup=mistral-ai$/);
  await expect(page.getByText('September 17, 2026')).toBeVisible();
  await expect(page.locator('#profile-monogram')).toHaveText('MA');
  await page.evaluate(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Profile link copied.')).toBeVisible();
  await page.getByRole('button', { name: 'Close startup profile' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(mistralButton).toBeFocused();

  await page.goto('/?startup=canva');
  await expect(page.getByRole('dialog', { name: 'Canva' })).toBeVisible();
  await page.getByRole('button', { name: 'Close startup profile' }).click();

  await page.getByRole('button', { name: 'About data' }).click();
  await expect(page.getByRole('dialog', { name: /Small, sourced, and honest/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close methodology' }).click();

  await page.getByRole('button', { name: 'Add a startup' }).click();
  await expect(page.getByRole('dialog', { name: 'Suggest a startup' })).toBeVisible();
  await expect(page.getByText(/prepares a public GitHub issue/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close submission form' }).click();

  expect(errors).toEqual([]);
});

test('mobile map-first layout, result sheet, filters, and profile stay usable', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('#map')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search startups' })).toBeVisible();
  const sheetToggle = page.getByRole('button', { name: /Explore startups/ });
  await expect(sheetToggle).toHaveAttribute('aria-expanded', 'true');
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: '/tmp/startupmap-mobile.png' });

  await sheetToggle.click();
  await expect(sheetToggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.locator('.discovery-panel').evaluate((element) => element.getBoundingClientRect().height))
    .toBeLessThanOrEqual(59);
  await sheetToggle.click();

  await page.locator('#sector-filter').selectOption('Mobility');
  await expect(page.getByText('4 startups', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open Careem/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Careem' });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    return box.y + box.height;
  }).toBeLessThanOrEqual(844);
  const profileBox = await dialog.boundingBox();
  expect(profileBox.width).toBeLessThanOrEqual(390);
  expect(profileBox.x).toBeGreaterThanOrEqual(0);
  await expect(page.getByRole('link', { name: /Visit Careem website/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/startupmap-mobile-profile.png' });
  await page.getByRole('button', { name: 'Close startup profile' }).click();
  await page.getByRole('button', { name: 'About data' }).click();
  await expect(page.getByRole('dialog', { name: /Small, sourced, and honest/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close methodology' }).click();

  expect(errors).toEqual([]);
});

test('tablet keeps the map and discovery rail in one viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('.discovery-panel')).toBeVisible();
  await expect(page.locator('.intel-panel')).toBeHidden();
  await expect(page.getByRole('searchbox', { name: 'Search startups' })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test('empty results recover and invalid deep links are sanitized', async ({ page }) => {
  await page.goto('/?startup=not-a-real-startup');
  await expect(page).toHaveURL(/\/$/);
  const search = page.getByRole('searchbox', { name: 'Search startups' });
  await search.fill('no-company-has-this-name');
  await expect(page.getByText('No startups match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Show all startups' }).click();
  await expect(page.locator('.startup-card')).toHaveCount(27);
  await expect(search).toBeFocused();
});

test('the map and list remain usable without external network requests', async ({ page }) => {
  await page.route('https://**', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.startup-card')).toHaveCount(27);
  await expect(page.locator('.leaflet-basemap-pane path').first()).toBeVisible();
  await expect(page.locator('.marker-cluster').first()).toBeVisible();
  await expect(page.locator('.startup-initials').first()).toBeVisible();
});
