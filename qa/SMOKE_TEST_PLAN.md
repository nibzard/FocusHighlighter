# Multilingual smoke test plan

## Goal
Verify that auto-highlight, question highlight, Study Strip, and exports work across English, Spanish, French, Chinese, and Arabic.

## Sample documents
Use the sample texts in `qa/samples/`:
- `qa/samples/sample-en.txt` (English)
- `qa/samples/sample-es.txt` (Spanish)
- `qa/samples/sample-fr.txt` (French)
- `qa/samples/sample-zh.txt` (Chinese)
- `qa/samples/sample-ar.txt` (Arabic)

## Preparation
1. Start the app (`npm install` then `npm run dev`).
2. Create PDF and DOCX versions of the samples as needed.
   - Use any editor (Word, Pages, Google Docs) and export to PDF.
   - Optional CLI: `pandoc qa/samples/sample-en.txt -o /tmp/sample-en.docx` (if installed).
3. Pick one real-world URL per language for URL testing (news article or blog post).

## Automated smoke checks (headless)
Run the Playwright smoke suite for fast coverage of text, URL, and PDF flows:

1. Install browsers once: `npx playwright install chromium`
2. Run: `npm run test:smoke`

Notes:
- Tests use `?qa=1` to enable deterministic embeddings so they run quickly without model downloads.
- The URL test mocks `r.jina.ai`; do a manual URL fetch in the browser for full coverage.

## Smoke matrix (minimal coverage)
- English: PDF upload (`sample-en.pdf`).
- Spanish: DOCX upload (`sample-es.docx`).
- French: URL fetch (French article URL).
- Chinese: Paste text (`sample-zh.txt`).
- Arabic: PDF upload (`sample-ar.pdf`) to validate RTL rendering.

## Performance expectations (baseline)
- Page 1 renders within a few seconds of upload (target: <= 3s on a typical laptop).
- First highlights appear shortly after render (target: <= 10s, before full indexing completes).
- Background indexing updates progress regularly and does not freeze scrolling, pinning, or navigation.
- Export shows clear status updates while generating PDFs; UI remains responsive.

## Steps and expected results
1. Load each source above and confirm:
   - Page 1 renders quickly with visible highlights.
   - Auto-highlight status updates appear and complete.
   - Study Strip lists verbatim highlighted sentences for the correct page or virtual page.
2. Question mode (cross-language):
   - Ask an English question while viewing the Chinese or Arabic sample.
   - Expect highlights to shift toward relevant sentences.
3. Pin/unpin:
   - Pin one highlight and verify it appears in Study Strip pinned group.
4. Export gating (partial coverage):
   - Trigger export before indexing completes (or when page/sentence caps apply).
   - Expect a confirmation message explaining partial coverage; cancel keeps status message.
   - Confirming proceeds with export and indicates partial coverage in status text.
5. Export:
   - Use "Download highlighted PDF" and verify the file opens with highlights present.
   - Use "Copy" and "Download highlights.md" from Study Strip.
6. Basic accessibility:
   - Navigate pages with keyboard shortcuts and verify focus remains visible.
   - Toggle list view to confirm readable contrast and non-color cues for intensity.
   - Use the page jump input with keyboard-only navigation.

## Pass criteria
- No crashes or console errors.
- Highlights appear in each language sample.
- Exports contain highlights and open successfully.
- Study Strip reflects pinned highlights and uses verbatim text.
