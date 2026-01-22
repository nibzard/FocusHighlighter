# SPECIFICATION.md — In‑Browser “Smart Highlighter” for Students (Transformers.js)

> **MVP promise:** A student drops in a PDF/Word doc or pastes a URL and **immediately** sees a page-by-page viewer where the **most important parts are already highlighted**—no prompt, no presets, no clicks beyond providing the document.
>
> **Primary output:** a **downloadable highlighted PDF** of the whole document (highlights embedded).  
> **Secondary output:** a **verbatim “Study Strip”** (a short list of highlighted lines exactly as in the document; **no rewriting**).

---

## 1) Product summary

**Working name:** FocusHighlighter.com (placeholder)

**One-liner:** Upload a document or link and get the “already-highlighted” version—like a smart student pre-highlighted what matters.

### Core JTBD
- **When** I have a long reading to learn,
- **I want** the important parts highlighted page-by-page,
- **So I can** study faster and focus on what matters.

### Non-negotiables
- **Zero-friction value:** Uploading a document must immediately render **Page 1 with highlights**.
- **Runs in-browser:** All ML runs client-side with **Transformers.js** (no inference backend).
- **No rewriting:** We only **select** and show original text spans; no paraphrases, no abstractive summaries.
- **Primary output is a highlighted PDF**, not a technical ranking report.
- **Secondary output is a short verbatim list** of the highlighted lines (“Study Strip”).

---

## 2) Supported inputs

### 2.1 PDF (required)
- Upload local `.pdf`
- Viewer renders true pages (page-by-page)
- Text extracted per page for scoring + mapping highlights to coordinates

### 2.2 Word (required)
- Upload local `.docx`
- Convert to HTML/text in-browser
- Viewer renders “virtual pages” (pagination by viewport height)
- Export: a generated “highlighted PDF” representing the rendered content (layout may differ from Word)

### 2.3 URL (required)
- Paste URL
- Fetch readable text/markdown through `r.jina.ai` by prefixing the URL:
  - `https://r.jina.ai/https://example.com/article`
- Viewer renders “virtual pages”
- Export: generated highlighted PDF of rendered content

### 2.4 Paste text (recommended)
- For privacy-sensitive sources or if URL fetch fails
- Viewer renders “virtual pages”
- Export: generated highlighted PDF of rendered content

---

## 3) Primary UX: Auto-Highlight (default)

### 3.1 Critical path (PDF)
1. User selects a PDF file.
2. App immediately:
   - Renders **Page 1** in the viewer.
   - Runs **Auto-Highlight** for Page 1 first (fast path).
   - Overlays highlights on Page 1 (visible outcome).
3. In parallel, the app continues indexing/highlighting remaining pages progressively.

**UX requirement:** The student should see Page 1 and at least some highlights within a few seconds on a typical laptop.

### 3.2 Viewer requirements (PDF)
- **Page-by-page viewer** with:
  - next/prev
  - page thumbnails (optional MVP)
  - jump-to-page
- Highlights:
  - translucent rectangles over text (like a highlighter)
  - intensity can reflect score (optional; do not rely on color alone)
- Interaction (secondary):
  - click highlight → show tooltip with verbatim text
  - “Pin to Study Strip” toggle

### 3.3 Viewer requirements (Word/URL/Text)
- Render as clean reading view (no HTML scripting).
- Paginate into “virtual pages” based on viewport height.
- Highlights appear inline (background color) with same “Pin” behavior.
- Maintain stable paragraph/sentence anchors for navigation and export.

---

## 4) Outputs

### 4.1 Primary: Download Highlighted PDF
**Button:** “Download highlighted PDF”

#### For PDF sources
- Export must preserve original PDF pages.
- Highlights must be embedded as:
  - PDF highlight annotations **or**
  - drawn translucent rectangles on top of original content
- Must open correctly in standard PDF viewers.

#### For Word/URL/Text sources
- Export generates a PDF from the rendered content (reflowed).
- Highlights embedded in generated PDF.
- Note in UI: “Exported PDF preserves highlights; layout may differ from the original Word/web page.”

### 4.2 Secondary: Study Strip (verbatim)
A compact list of extracted, highlighted lines:
- Grouped by page (PDF) or virtual page/section (Word/URL/Text)
- Each line is **verbatim** from the document
- No paraphrasing, no summarization, no added commentary

**Exports:**
- Copy to clipboard
- Download `highlights.md` (verbatim bullets)

---

## 5) Highlighting logic (no prompt required)

### 5.1 Design principle: “Salience selection” not rewriting
The system can compute scores, but the only content displayed/exported is **copied from the document** (exact text spans).

### 5.2 Two highlighting modes (MVP)
1. **Auto-Highlight (default):** “What’s important on this page/document?”
2. **Question Highlight (optional add-on):** user asks a question, highlights relevant spans

Auto-Highlight must be the primary UX; Question mode is a refinement tool.

---

## 6) ML approach (Transformers.js, multilingual)

### 6.1 Model choice (MVP)
Use a multilingual sentence embedding model that’s practical in-browser:

- **Recommended:** `Xenova/multilingual-e5-small` (feature-extraction / embeddings)
  - Multilingual semantic similarity
  - Works with Transformers.js pipeline
  - Suitable for both Auto-Highlight (salience via centrality) and Question mode (query-to-sentence similarity)

> Note: This MVP uses sentence embeddings to determine importance and relevance. It does not generate text.

### 6.2 Runtime & device selection
- Use `@huggingface/transformers` (Transformers.js)
- Prefer WebGPU when available; fallback to WASM/CPU.
- Use quantized weights when possible (`dtype: 'q4'` on WebGPU; `'q8'` on CPU) to reduce download size and improve speed.

### 6.3 Embedding pooling
Feature-extraction returns token vectors. Convert to a single vector per sentence via:
- attention-mask mean pooling
- L2 normalization

### 6.4 Similarity
Cosine similarity between vectors.

---

## 7) Auto-Highlight algorithm (queryless “importance”)

### 7.1 Inputs
- Document segmented into sentences with page/position metadata
- Sentence embeddings

### 7.2 Scoring idea: “central + non-redundant”
We want sentences that are:
- representative of the page/topic (“centrality”)
- not repetitive (“diversity”)
- not too short/noisy (length prior)

#### Step A — Compute centroids
- **Page centroid:** mean of sentence embeddings on that page
- **Doc centroid:** mean of sampled sentence embeddings across document (for long docs, sample to limit compute)

#### Step B — Raw salience score per sentence
For sentence *i* on page *p*:

```
centrality = cos(e_i, pageCentroid_p)
globality  = cos(e_i, docCentroid)
position   = positionPrior(i)          // early sentences in sections get a slight boost
length     = lengthPrior(text_i)       // penalize too-short / mostly symbols
score_raw  = 0.65*centrality + 0.25*globality + 0.07*position + 0.03*length
```

Priors are heuristics and must be language-agnostic:
- `positionPrior`: e.g., first 20% sentences on a page get a small boost (do not over-weight).
- `lengthPrior`: penalize sentences under N characters and those with low alphabetic/ideographic ratio.

#### Step C — Select highlights with MMR (diversity)
Select top sentences using Maximal Marginal Relevance:

```
selected = []
while len(selected) < K_page and candidates remain:
  pick s maximizing: score_raw(s) - λ * max_{t in selected} cos(e_s, e_t)
```

Defaults:
- `K_page`: min(6, ceil(0.2 * numSentencesOnPage)), with a floor of 2 when possible
- `λ`: 0.35

#### Step D — Expand to highlight spans
MVP highlight granularity:
- highlight the **whole selected sentence** (verbatim)
- optional: include 1 sentence of context before/after (toggle)

### 7.3 Thresholding / intensity
- If a page is extremely short: highlight fewer sentences.
- If a page is very dense: highlight up to `K_page_max` (configurable).
- Optional: highlight intensity based on normalized score within page.

### 7.4 Immediate-value strategy (fast path)
To guarantee “upload → instant value”:
- Prioritize Page 1:
  1) Extract + segment Page 1 text
  2) Compute embeddings for Page 1 sentences
  3) Score + highlight Page 1
- Only then continue with Page 2…N progressively.

---

## 8) Optional Question Highlight mode (secondary)

### 8.1 Behavior
- User enters a question (any language).
- Compute query embedding (`"query: ..."` prefix for E5).
- Score each sentence: `score = cos(queryEmb, sentenceEmb)`
- Select top K with diversity (MMR) and highlight those sentences.

### 8.2 UX
- Question box + “Highlight answers”
- Preset chips (student helper) that fill the question box
- This mode never replaces Auto-Highlight; it layers on top (clear UI toggle: “Auto” vs “Question”).

---

## 9) Document processing pipelines

## 9.1 PDF pipeline (true page highlights)

### Libraries
- `pdfjs-dist` (PDF.js) for rendering + text extraction
- `pdf-lib` for exporting highlighted PDFs (overlay rectangles or annotations)

### Extraction + mapping requirements
We must map selected sentences back to highlight rectangles on the page.

#### Text extraction
- For each page:
  - `page.getTextContent()` returns `items[]` with strings and transforms
- Build a “text map”:
  - concatenate items into a page string with offsets
  - keep a mapping from character ranges → list of text items (with coordinates)

#### Sentence segmentation on PDF
- Segment the page text into sentences.
- Each sentence stores:
  - page number
  - character start/end in page text
  - backing text items list (for coordinates)

#### Highlight rectangles (viewer)
- Use PDF.js page viewport transform to convert text item boxes to screen coordinates.
- Create highlight rectangles per sentence by unioning item boxes for the sentence range.
- Draw rectangles in an overlay layer (SVG/Canvas/absolute divs).

#### Export highlighted PDF (PDF sources)
Two acceptable implementations:

**Option 1 — Draw rectangles into PDF (simplest)**
- Load original PDF bytes via `pdf-lib`
- For each highlight rectangle in PDF coordinates:
  - draw a semi-transparent rectangle on the page
- Save as new PDF

**Option 2 — Add highlight annotations**
- Add PDF “Highlight” annotations (if library support is sufficient)
- Viewers will show highlight markup with selectable behavior

**Coordinate conversion (must be implemented carefully):**
- PDF.js uses a viewport with origin at top-left in screen coords; PDF coordinate system typically bottom-left.
- Use viewport transforms and page height to convert:
  - `(x_screen, y_screen)` → `(x_pdf, y_pdf)` with y inversion and scale correction.

### Performance constraints
- Do not embed the entire PDF before showing Page 1.
- Progressive indexing:
  - show “Processing page X of N”
  - allow cancel

### Handling scanned PDFs
- If extracted text is nearly empty:
  - show: “This looks like a scanned PDF (image-only). OCR is not included in MVP.”

---

## 9.2 Word (.docx) pipeline

### Libraries
- `mammoth` (client-side docx to HTML/text conversion)

### Rendering
- Render sanitized HTML into a reading view (no script execution).
- Segment into sentences from text content (preserve paragraph boundaries).

### “Virtual pages”
Paginate by measuring rendered blocks and splitting into pages of ~viewport height (or a fixed paper size).

### Export highlighted PDF (Word sources)
- Generate PDF from rendered content:
  - Option A: `html2canvas` + `jsPDF` (image-based PDF; easy but less selectable text)
  - Option B (preferred if feasible): generate vector/text PDF using `pdf-lib` or `pdfmake` based on text layout (more work)
- MVP can start with image-based export if needed; clearly note “text may not be selectable” (try to avoid if possible).

---

## 9.3 URL pipeline

### Fetch
- Prefix URL with `https://r.jina.ai/` and fetch.
- Treat response as markdown/text.

### Rendering
- Render markdown with HTML disabled/sanitized (or plain text MVP).
- Segment sentences and highlight inline.

### Export
Same as Word/Text: generate a PDF from the rendered content with highlights.

---

## 10) Data structures

```ts
type DocumentSource =
  | { kind: 'pdf'; fileName: string; pageCount: number }
  | { kind: 'docx'; fileName: string }
  | { kind: 'url'; url: string; fetchedVia: 'r.jina.ai' }
  | { kind: 'text'; title?: string };

type SentenceUnit = {
  id: string;                 // stable ID (hash of text + position)
  sourceKind: DocumentSource['kind'];
  page?: number;              // PDF true page
  virtualPage?: number;       // Word/URL/Text
  paragraphIndex: number;
  sentenceIndex: number;
  text: string;               // verbatim sentence
  // offsets in a normalized fullText (for selection + exports):
  charStart: number;
  charEnd: number;
  // PDF-only: mapping back to text items for coordinates
  pdfItemRefs?: Array<{ itemIndex: number; charStart: number; charEnd: number }>;
};

type IndexedDocument = {
  source: DocumentSource;
  fullText: string;
  sentences: SentenceUnit[];
  embeddings: Float32Array; // [numSentences, embDim]
  embDim: number;
};

type Highlight = {
  sentenceId: string;
  score: number;
  rank: number;
  mode: 'auto' | 'question';
};

type HighlightSet = {
  mode: 'auto' | 'question';
  query?: string;              // only for question mode
  createdAt: number;
  highlights: Highlight[];
};
```

---

## 11) UI/UX details

### 11.1 States
- Empty state: upload/paste URL
- Loading state:
  - “Rendering page 1…”
  - “Highlighting page 1…”
  - progress bar for remaining pages
- Ready state:
  - page viewer with highlights
  - study strip drawer

### 11.2 Controls (must not block value)
- Auto highlight intensity:
  - “Less / Default / More” (3-step) is friendlier than a numeric slider in MVP
- Toggle: “Show Study Strip”
- Optional tab: “Ask a question” (question highlight)

### 11.3 Accessibility
- Highlights must be visible with sufficient contrast.
- Provide an alternate view: list of highlighted lines (Study Strip).
- Keyboard navigation for next/prev page and selecting highlights.

---

## 12) Privacy & security

- In-browser inference: document text does not leave the device for ML.
- URL mode: disclose that the URL is fetched through `r.jina.ai` (third-party content extraction).
- Sanitize any rendered HTML (Word and URL markdown) to prevent script injection.
- Default: do not persist documents; optional “remember on this device” can store only locally.

---

## 13) Performance guardrails

- Progressive processing; always prioritize Page 1.
- Hard caps (configurable):
  - max pages to process automatically (e.g., 200) with warning
  - max sentences (e.g., 20,000) with warning
- Batch embedding:
  - adaptive batch size based on device
  - yield to UI between batches
- Worker usage:
  - run embedding + scoring in a Web Worker when possible

---

## 14) Acceptance criteria (Definition of Done)

### Auto-Highlight (must)
- Upload a typical text-based PDF → Page 1 renders with visible highlights automatically.
- Page navigation works; highlights appear on subsequent pages after processing.
- Study Strip shows verbatim extracted lines.

### Export (must)
- “Download highlighted PDF” produces a valid PDF:
  - For PDF inputs: original pages preserved with highlights on the correct pages.
  - For Word/URL/Text: generated PDF with highlights (layout may differ).

### Multilingual (must)
- Works for at least: English, Spanish, French, Chinese, Arabic (smoke tests)
  - Auto-Highlight still yields highlights
  - Question Highlight works cross-language (question in one language, doc in another) to the extent the embedding model supports it

### No rewriting (must)
- No generated summaries/paraphrases are shown or exported.
- All exported text lines are verbatim excerpts.

---

## 15) Milestones & task breakdown

### Milestone 1 — Viewer + PDF ingestion (Page 1 fast path)
- PDF upload, render page 1 with PDF.js
- Extract page 1 text + segment sentences
- Implement highlight overlay layer (no ML yet)

### Milestone 2 — Transformers.js embeddings
- Integrate Transformers.js pipeline for multilingual embeddings
- Batch embed page 1 sentences and compute Auto-Highlight selection
- Show highlights on page 1

### Milestone 3 — Progressive full-doc processing
- Iterate pages 2…N:
  - extract, embed, highlight
- Add progress UI + cancel

### Milestone 4 — Export highlighted PDF (PDF inputs)
- Map sentence highlights → rectangle coordinates
- Use pdf-lib to draw rectangles onto the original PDF and export
- Validate in multiple PDF viewers

### Milestone 5 — Word/URL/Text
- DOCX import via mammoth + render + virtual pages + highlights
- URL fetch via r.jina.ai + render + virtual pages + highlights
- Export generated highlighted PDF for these sources

### Milestone 6 — Study Strip + optional Question mode
- Study strip: pin/unpin highlights, export verbatim markdown
- Optional: question highlight as a separate mode/toggle

---

## 16) Notes on “importance” without prompts (why this is still aligned)
Auto-Highlight necessarily involves **ranking/selection**, but it does **not** generate new text. The “importance” score is just a way to decide *which original sentences to highlight*, similar to how a student chooses what to highlight. The output remains **exact excerpts** from the document.

---

## 17) Future upgrades (post-MVP)
- Token-level highlighting (instead of whole-sentence highlights) using a specialized highlight model (heavier).
- OCR for scanned PDFs.
- Better Word/URL PDF export with selectable text preserved.
- Two-stage ranking (embeddings → multilingual reranker) for higher precision in Question mode.

