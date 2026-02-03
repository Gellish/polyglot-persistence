import { test, expect } from '@playwright/test';

test('Column Reordering via Drag and Drop', async ({ page }) => {
    // 1. Go to dashboard
    console.log('Navigating to dashboard...');
    await page.goto('http://127.0.0.1:5177');
    await page.waitForTimeout(1000);

    // 2. Open Picker
    await page.click('#btnColumns');
    const picker = page.locator('.column-picker-dialog');
    await expect(picker).toBeVisible();

    // 3. Identify First and Second Columns
    const rows = picker.locator('.column-option');

    // First item
    const firstOption = rows.first(); // Assuming 'id'
    const firstText = await firstOption.locator('span').textContent();
    console.log('First Column is:', firstText);

    // Second item
    const secondOption = rows.nth(1); // Assuming 'type'
    const secondText = await secondOption.locator('span').textContent();
    console.log('Second Column is:', secondText);

    // 4. Perform Drag and Drop
    // Drag first option to second option
    console.log('Dragging first column to second position...');
    await firstOption.dragTo(secondOption);

    // 5. Verify Order Change
    // After drop, updateColumnPicker() re-renders the list.
    // The first option should now be the OLD second option.

    // Wait for re-render (mutation observer or simple timeout/check)
    await page.waitForTimeout(500);

    const newFirstOption = page.locator('.column-option').first();
    const newFirstText = await newFirstOption.locator('span').textContent();
    console.log('New First Column is:', newFirstText);

    expect(newFirstText).toBe(secondText);
    console.log('Reordering SUCCESS: Columns swapped via D&D.');
});
