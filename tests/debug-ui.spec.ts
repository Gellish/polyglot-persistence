import { test, expect } from '@playwright/test';

test('Dashboard UI Sanity Check', async ({ page }) => {
    // 1. Go to the dashboard
    console.log('Navigating to dashboard...');
    await page.goto('http://127.0.0.1:5177');

    // 2. data-grid should be visible
    await expect(page.locator('table')).toBeVisible();

    // 3. Open Columns Picker
    console.log('Opening Column Picker...');
    await page.click('#btnColumns');

    const picker = page.locator('.column-picker-dialog');
    await expect(picker).toBeVisible();

    // 4. Test Toggling via Row Click
    // Find a column to toggle (e.g., "id")
    // Note: The structure is div.column-option > input[type=checkbox] + span + buttons
    const idOption = picker.locator('.column-option').filter({ hasText: 'id' }).first();
    const checkbox = idOption.locator('input[type="checkbox"]');

    // Initial state should be checked (default)
    expect(await checkbox.isChecked()).toBe(true);

    // Click the ROW (not the checkbox directly)
    console.log('Clicking "id" row to toggle...');
    await idOption.click();

    // Should be unchecked now
    expect(await checkbox.isChecked()).toBe(false);

    // Click again to re-check
    await idOption.click();
    expect(await checkbox.isChecked()).toBe(true);

    console.log('Toggle logic verified!');

    // 5. Take a screenshot for the user
    await page.screenshot({ path: 'debug-ui-screenshot.png', fullPage: true });
    console.log('Screenshot saved to debug-ui-screenshot.png');
});
