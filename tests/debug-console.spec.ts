import { test, expect } from '@playwright/test';

test('Capture Console Errors', async ({ page }) => {
    // Listen for console logs
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
        }
    });

    // Listen for uncaught exceptions
    page.on('pageerror', exception => {
        console.log(`[BROWSER UNCAUGHT EXCEPTION] "${exception.message}"`);
        console.log(exception.stack);
    });

    console.log('Navigating to dashboard...');
    await page.goto('http://127.0.0.1:5177');

    // Wait to ensure app loads (or fails)
    await page.waitForTimeout(3000);

    // Take a screenshot of the state
    await page.screenshot({ path: 'debug-console-error.png' });
});
