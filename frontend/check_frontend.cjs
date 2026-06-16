const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR: ${msg.text()}`);
    } else {
      console.log(`PAGE LOG: ${msg.text()}`);
    }
  });

  // Capture uncaught exceptions
  page.on('pageerror', error => {
    console.log(`UNCAUGHT EXCEPTION: ${error.message}`);
  });

  console.log("Navigating to http://localhost:5173/...");
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  
  // Wait a moment for any async React renders to crash
  await page.waitForTimeout(2000);
  
  const screenshotPath = '/Users/vinoojacob/.gemini/antigravity-ide/brain/8cff933c-0c5f-4fb0-a99a-87a0cba9e06d/playwright_screenshot.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to: ${screenshotPath}`);

  await browser.close();
})();
