// Captures every main screen at chosen widths/themes into artifacts/ui/redesign (needs `vite preview` on :4173).
// WIDTHS=360,390,1280 THEMES=dark,light ONLY=home,statistics,device,settings,config SEED=1 node tests/ui-screenshots.mjs
// SEED=1 injects demo session history into the browser only, for chart screenshots.
import { chromium } from 'playwright-core';
const widths = (process.env.WIDTHS || '390').split(',').map(Number);
const themes = (process.env.THEMES || 'dark,light').split(',');
const only = (process.env.ONLY || 'home,statistics,device,settings,config').split(',');
const base = 'http://127.0.0.1:4173';
const b = await chromium.launch({ headless: true, channel: 'msedge' });
for (const width of widths)
  for (const theme of themes) {
    const p = await b.newPage({
      viewport: { width, height: width > 800 ? 900 : 844 },
      deviceScaleFactor: width > 800 ? 1 : 2
    });
    p.on('pageerror', (e) => console.log('PAGEERR', e.message));
    const seed = process.env.SEED
      ? Array.from({ length: 9 }, (_, i) => {
          const end = Date.now() - i * 86400000 * 1.3;
          const hr = [1820, 1760, 1900, 1650, 1880, 1940, 1710, 1830, 1790][i];
          return {
            id: 'demo' + i,
            title: 'XMR',
            subtitle: 'RandomX',
            coinSymbol: 'XMR',
            coinLogoText: 'XMR',
            coinLogoClass: 'x',
            durationSeconds: 1800 + i * 420,
            acceptedShares: 12 + i * 3,
            rejectedShares: i % 3,
            averageHashrate: hr,
            startedAt: new Date(end - 3600000).toISOString(),
            endedAt: new Date(end).toISOString(),
            algorithm: 'rx/0',
            sampleCount: 40,
            sampleWindowSeconds: 600
          };
        })
      : null;
    await p.addInitScript(
      ({ m, sd }) => {
        if (sd) localStorage.setItem('androminer-session-history', JSON.stringify(sd));
        localStorage.setItem('androminer-phone-risk-warning-accepted', 'true');
        localStorage.setItem('androminer-system-check-complete', 'true');
        localStorage.setItem('androminer-theme', m);
      },
      { m: theme, sd: seed }
    );
    await p.goto(base);
    await p.waitForTimeout(700);
    const shot = async (n, full = true) => {
      await p.waitForTimeout(450);
      if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
        console.log('OVERFLOW', n, theme, width);
      await p.screenshot({
        path: `artifacts/ui/redesign/${n}-${theme}-${width}.png`,
        fullPage: full
      });
    };
    const nav = (name) =>
      p.locator('.app-bottom-nav .nav-primary button').filter({ hasText: name }).first().click();
    if (only.includes('home')) {
      await shot('home');
    }
    if (only.includes('statistics')) {
      await nav('Statistics');
      await shot('statistics');
    }
    if (only.includes('device')) {
      await nav('Device');
      await shot('device');
    }
    if (only.includes('settings')) {
      await nav('Settings');
      await shot('settings');
    }
    if (only.includes('config')) {
      await nav('Home');
      await p.getByRole('button', { name: 'Edit mining setup' }).first().click();
      await shot('config');
    }
    await p.close();
  }
await b.close();
