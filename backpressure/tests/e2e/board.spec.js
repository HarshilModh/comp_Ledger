const { test, expect } = require('@playwright/test');

test('kanban board loads with three columns', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TaskFlow/);
  await expect(page.locator('text=To Do').first()).toBeVisible();
  await expect(page.locator('text=In Progress').first()).toBeVisible();
  await expect(page.locator('text=Done').first()).toBeVisible();
});
