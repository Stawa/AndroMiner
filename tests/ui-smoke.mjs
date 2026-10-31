import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : { channel: 'msedge' })
});
await mkdir('artifacts/ui', { recursive: true });
try {
  for (const width of [360, 1280]) {
    for (const theme of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript((mode) => {
        localStorage.setItem('androminer-phone-risk-warning-accepted', 'true');
        localStorage.setItem('androminer-system-check-complete', 'true');
        localStorage.setItem('androminer-theme', mode);
      }, theme);
      await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:5173');
      await page.getByRole('button', { name: 'Miner', exact: true }).click();
      await page.getByRole('button', { name: 'Safety', exact: true }).click();
      const duration = page.getByRole('spinbutton', { name: 'Maximum session duration (minutes)' });
      await duration.fill('1441');
      await page.getByText('Use a session duration between 0 and 1440 minutes.').waitFor();
      await duration.fill('10');
      assert.equal(await duration.inputValue(), '10');
      await page.screenshot({ path: `artifacts/ui/safety-${width}-${theme}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Pool', exact: true }).click();
      await page.getByRole('button', { name: 'Test pool connection', exact: true }).click();
      await page.getByText('Connection testing is available in the Android app.').waitFor();
      await page.screenshot({ path: `artifacts/ui/pool-${width}-${theme}.png`, fullPage: true });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        'No horizontal overflow'
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log('Safety and pool controls passed at 360px and 1280px in light/dark themes.');

  // Language selector: switching applies at once, persists across a reload, and no screen overflows.
  const page = await browser.newPage({ viewport: { width: 360, height: 850 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('androminer-phone-risk-warning-accepted', 'true');
    localStorage.setItem('androminer-system-check-complete', 'true');
  });
  await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /^Language/ }).click();
  await page.getByRole('button', { name: '简体中文' }).click();
  await page.getByRole('heading', { name: '设置', level: 1 }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'zh-CN');
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('heading', { name: '设置', level: 1 }).waitFor();
  await page.screenshot({ path: 'artifacts/ui/language-zh-CN.png', fullPage: true });

  for (const locale of ['id', 'zh-CN', 'en']) {
    await page.evaluate((value) => localStorage.setItem('androminer-language', value), locale);
    await page.reload();
    const tabs = page.locator('.nav-primary .bottom-nav-button');
    for (let index = 0; index < (await tabs.count()); index += 1) {
      await tabs.nth(index).click();
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `No horizontal overflow on tab ${index} in ${locale}`
      );
    }
  }
  assert.deepEqual(errors, []);
  await page.close();
  console.log('Language switching, persistence and layout passed in en, id and zh-CN.');
} finally {
  await browser.close();
}
