import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sampleText =
  'Focus highlighters help students concentrate. Reviewing definitions and examples strengthens recall. Active reading beats passive scrolling. Summarize key ideas after each section.';

const createSamplePdf = async (text: string | string[], options: { fileName?: string } = {}) => {
  const pages = Array.isArray(text) ? text : [text];
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  for (const pageText of pages) {
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();
    page.drawText(pageText, {
      x: 50,
      y: height - 50,
      size: fontSize,
      font,
      maxWidth: 500,
      lineHeight: 16,
    });
  }
  const pdfBytes = await pdfDoc.save();
  const fileName = options.fileName ?? `focus-smoke-${Date.now()}.pdf`;
  const filePath = join(tmpdir(), fileName);
  await writeFile(filePath, pdfBytes);
  return filePath;
};

test('pasted text renders inline highlights', async ({ page }) => {
  await page.goto('/?qa=1');
  await page.fill('#text-input', sampleText);
  await page.click('#text-render');
  await expect(page.locator('.docx-highlight').first()).toBeVisible();
});

test('url fetch renders inline highlights', async ({ page }) => {
  await page.route('**/r.jina.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: sampleText,
    });
  });
  await page.goto('/?qa=1');
  await page.fill('#url-input', 'https://example.com/article');
  await page.click('#url-fetch');
  await expect(page.locator('.docx-highlight').first()).toBeVisible();
});

test('pdf upload renders highlight rectangles', async ({ page }) => {
  const pdfPath = await createSamplePdf(sampleText);
  try {
    await page.goto('/?qa=1');
    await page.setInputFiles('#pdf-input', pdfPath);
    await expect(page.locator('.highlight-rect').first()).toBeVisible();
  } finally {
    await unlink(pdfPath).catch(() => undefined);
  }
});

test('latest pdf upload wins when an earlier upload finishes late', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      const file = this as File;
      if (file.name && file.name.includes('slow')) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          window.setTimeout(() => {
            original.call(file).then(resolve).catch(reject);
          }, 400);
        });
      }
      return original.call(file);
    };
  });

  const slowPdf = await createSamplePdf([sampleText, sampleText], {
    fileName: `slow-${Date.now()}.pdf`,
  });
  const fastPdf = await createSamplePdf(sampleText, {
    fileName: `fast-${Date.now()}.pdf`,
  });
  try {
    await page.goto('/?qa=1');
    await page.setInputFiles('#pdf-input', slowPdf);
    await page.setInputFiles('#pdf-input', fastPdf);
    await expect(page.locator('#page-indicator')).toHaveText(/Page 1 \/ 1/);
    await page.waitForTimeout(800);
    await expect(page.locator('#page-indicator')).toHaveText(/Page 1 \/ 1/);
  } finally {
    await unlink(slowPdf).catch(() => undefined);
    await unlink(fastPdf).catch(() => undefined);
  }
});

test('background indexing refreshes highlights on the current pdf page', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestIdleCallback = (callback) => window.setTimeout(() => callback(), 160);
  });
  const pageOneText = Array.from({ length: 180 }, (_, index) => `Page one sentence ${index + 1}.`).join(' ');
  const pageTwoText = 'Page two sentence one. Page two sentence two.';
  const fillerText = Array.from({ length: 90 }, (_, index) => `Filler sentence ${index + 1}.`).join(' ');
  const extraPages = Array.from({ length: 4 }, () => fillerText);
  const pdfPath = await createSamplePdf([pageOneText, pageTwoText, ...extraPages], {
    fileName: `refresh-${Date.now()}.pdf`,
  });
  try {
    await page.goto('/?qa=1');
    await page.setInputFiles('#pdf-input', pdfPath);
    const toggle = page.locator('#progress-toggle');
    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(page.locator('#progress-status')).toContainText('Indexing paused');
    await expect(page.locator('#page-next')).toBeEnabled();
    await page.click('#page-next');
    await expect(page.locator('#page-indicator')).toContainText('Page 2 / 6');
    const highLowHighlights = page.locator(
      '.highlight-rect[data-intensity="high"], .highlight-rect[data-intensity="low"]',
    );
    const hasHighLow = (await highLowHighlights.count()) > 0;
    if (!hasHighLow) {
      await expect(page.locator('.highlight-rect[data-intensity="medium"]').first()).toBeVisible();
    }
    await toggle.click();
    await expect(highLowHighlights.first()).toBeVisible();
  } finally {
    await unlink(pdfPath).catch(() => undefined);
  }
});
