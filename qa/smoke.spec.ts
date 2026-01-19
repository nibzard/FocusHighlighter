import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sampleText =
  'Focus highlighters help students concentrate. Reviewing definitions and examples strengthens recall. Active reading beats passive scrolling. Summarize key ideas after each section.';

const createSamplePdf = async (text: string) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const { height } = page.getSize();
  page.drawText(text, {
    x: 50,
    y: height - 50,
    size: fontSize,
    font,
    maxWidth: 500,
    lineHeight: 16,
  });
  const pdfBytes = await pdfDoc.save();
  const filePath = join(tmpdir(), `focus-smoke-${Date.now()}.pdf`);
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
