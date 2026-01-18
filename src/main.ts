import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">FocusHighlighter</p>
      <h1>Drop a PDF. See page 1 instantly.</h1>
      <p class="lede">
        Upload a PDF to render page 1 with PDF.js. Highlights arrive next.
      </p>
    </header>
    <section class="stage">
      <article class="upload-card">
        <div>
          <h2>PDF upload</h2>
          <p class="muted">
            Start with a local PDF. We render page 1 on the spot to prove the pipeline.
          </p>
        </div>
        <label class="dropzone" for="pdf-input">
          <input id="pdf-input" type="file" accept="application/pdf" />
          <span class="dropzone-title">Choose a PDF</span>
          <span class="dropzone-subtitle">or drag & drop here</span>
        </label>
        <div class="upload-meta">
          <p id="file-name" class="meta-line">No file selected.</p>
          <p id="file-status" class="meta-line">Upload a PDF to render page 1.</p>
        </div>
      </article>
      <article class="viewer-card">
        <div class="viewer-header">
          <div>
            <h2>Page preview</h2>
            <p class="muted">PDF.js canvas render</p>
          </div>
          <span id="page-indicator" class="pill">Page 1 / -</span>
        </div>
        <div id="viewer-stage" class="viewer-stage">
          <div id="viewer-placeholder" class="viewer-placeholder">
            Page 1 will appear here after upload.
          </div>
          <div id="pdf-stack" class="pdf-stack" aria-hidden="true">
            <canvas id="pdf-canvas" class="pdf-canvas" aria-label="PDF page preview"></canvas>
            <div id="highlight-layer" class="highlight-layer"></div>
          </div>
        </div>
        <div class="progress-panel" aria-live="polite">
          <div class="progress-meta">
            <span class="progress-title">Background indexing</span>
            <span id="progress-count" class="progress-count">0 / 0 pages</span>
          </div>
          <div class="progress-bar">
            <div id="progress-fill" class="progress-fill"></div>
          </div>
          <p id="progress-status" class="muted progress-status">Waiting for PDF upload.</p>
        </div>
        <div class="export-panel">
          <button id="download-highlighted" class="primary-button" type="button" disabled>
            Download highlighted PDF
          </button>
          <p class="muted export-note">Embeds highlight rectangles into the original PDF.</p>
        </div>
      </article>
    </section>
    <section class="strip-card" aria-live="polite">
      <div class="strip-header">
        <div>
          <h2>Study Strip</h2>
          <p class="muted">Verbatim highlights grouped by page. Pin the lines you want to keep.</p>
        </div>
        <span id="study-strip-count" class="pill">0 pinned</span>
      </div>
      <div id="study-strip-list" class="strip-list" role="list"></div>
      <p id="study-strip-empty" class="muted strip-empty">Upload a PDF to populate the study strip.</p>
    </section>
  </main>
`;

const pdfInput = document.querySelector<HTMLInputElement>('#pdf-input');
const dropzone = document.querySelector<HTMLLabelElement>('.dropzone');
const fileName = document.querySelector<HTMLParagraphElement>('#file-name');
const fileStatus = document.querySelector<HTMLParagraphElement>('#file-status');
const pageIndicator = document.querySelector<HTMLSpanElement>('#page-indicator');
const viewerStage = document.querySelector<HTMLDivElement>('#viewer-stage');
const viewerPlaceholder = document.querySelector<HTMLDivElement>('#viewer-placeholder');
const pdfStack = document.querySelector<HTMLDivElement>('#pdf-stack');
const pdfCanvas = document.querySelector<HTMLCanvasElement>('#pdf-canvas');
const pdfContext = pdfCanvas?.getContext('2d');
const highlightLayer = document.querySelector<HTMLDivElement>('#highlight-layer');
const progressStatus = document.querySelector<HTMLParagraphElement>('#progress-status');
const progressCount = document.querySelector<HTMLSpanElement>('#progress-count');
const progressFill = document.querySelector<HTMLDivElement>('#progress-fill');
const downloadButton = document.querySelector<HTMLButtonElement>('#download-highlighted');
const studyStripList = document.querySelector<HTMLDivElement>('#study-strip-list');
const studyStripEmpty = document.querySelector<HTMLParagraphElement>('#study-strip-empty');
const studyStripCount = document.querySelector<HTMLSpanElement>('#study-strip-count');

let pdfDoc: PDFDocumentProxy | null = null;
let currentPage: PDFPageProxy | null = null;
let renderTask: RenderTask | null = null;
let resizeTimer: number | undefined;
let currentViewport: ReturnType<PDFPageProxy['getViewport']> | null = null;
let pdfBytes: ArrayBuffer | null = null;
let currentFileName: string | null = null;
const pinnedHighlightIds = new Set<string>();

type IndexedPage = {
  pageNumber: number;
  textMap: PageTextMap;
  sentences: SentenceSegment[];
  highlights: SentenceSegment[];
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
};

type PdfTextMarkedContent = {
  type: string;
  id?: string;
};

type PdfTextContent = {
  items: Array<PdfTextItem | PdfTextMarkedContent>;
};

type PdfTextItemRange = {
  itemIndex: number;
  charStart: number;
  charEnd: number;
};

type PageTextMap = {
  fullText: string;
  items: PdfTextItem[];
  itemRanges: PdfTextItemRange[];
};

type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SentenceSegment = {
  id: string;
  page: number;
  paragraphIndex: number;
  sentenceIndex: number;
  charStart: number;
  charEnd: number;
  text: string;
};

type ParagraphRange = {
  start: number;
  end: number;
};

type SegmentedTextChunk = {
  text: string;
  index: number;
};

type SentenceSegmenter = {
  segment: (input: string) => Iterable<{ segment: string; index: number }>;
};

type SentenceSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'sentence' },
) => SentenceSegmenter;

type EmbeddingDevice = 'webgpu' | 'wasm';

type EmbeddingTokenizerOutput = {
  attention_mask?: unknown;
};

type EmbeddingTokenizer = (
  inputs: string[] | string,
  options?: Record<string, unknown>,
) => Promise<EmbeddingTokenizerOutput>;

type EmbeddingPipeline = ((
  inputs: string[] | string,
  options?: Record<string, unknown>,
) => Promise<unknown>) & {
  tokenizer?: EmbeddingTokenizer;
};

type TransformersModule = {
  pipeline: (task: string, model?: string, options?: Record<string, unknown>) => Promise<EmbeddingPipeline>;
  env: {
    allowLocalModels?: boolean;
    backends?: {
      onnx?: {
        wasm?: {
          numThreads?: number;
        };
      };
    };
  };
};

const embeddingModelId = 'Xenova/multilingual-e5-small';

let currentPageTextMap: PageTextMap | null = null;
let currentPageSentences: SentenceSegment[] = [];
const maxHighlightSentences = 6;
const highlightMmrLambda = 0.35;
let embeddingPipelinePromise: Promise<EmbeddingPipeline> | null = null;
let embeddingBackend: EmbeddingDevice | null = null;
let embeddingRequestId = 0;
let currentPageEmbeddings: Float32Array[] | null = null;
let currentPageHighlightSentences: SentenceSegment[] = [];
const indexedPages = new Map<number, IndexedPage>();
let backgroundProcessId = 0;
let backgroundProcessedPages = 0;
let backgroundTotalPages = 0;

const getSentenceSegmenter = (): SentenceSegmenter | null => {
  if (typeof Intl === 'undefined') {
    return null;
  }

  const segmenterConstructor = (Intl as { Segmenter?: SentenceSegmenterConstructor }).Segmenter;
  if (!segmenterConstructor) {
    return null;
  }

  return new segmenterConstructor(undefined, { granularity: 'sentence' });
};

const sentenceSegmenter = getSentenceSegmenter();

const getEmbeddingDevice = (): EmbeddingDevice =>
  typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';

const formatEmbeddingDeviceLabel = (device: EmbeddingDevice) => (device === 'webgpu' ? 'WebGPU' : 'WASM');

const configureTransformersEnv = (env: TransformersModule['env']) => {
  if (!env || typeof env !== 'object') {
    return;
  }

  env.allowLocalModels = false;

  const threads =
    typeof navigator !== 'undefined'
      ? Math.max(1, Math.min(4, navigator.hardwareConcurrency ?? 4))
      : 1;

  const wasmConfig = env.backends?.onnx?.wasm;
  if (wasmConfig) {
    wasmConfig.numThreads = threads;
  }
};

const createEmbeddingPipeline = async (device: EmbeddingDevice) => {
  const { pipeline, env } = (await import('@huggingface/transformers')) as TransformersModule;
  configureTransformersEnv(env);
  const dtype = device === 'webgpu' ? 'q4' : 'q8';
  const extractor = await pipeline('feature-extraction', embeddingModelId, { device, dtype });
  return { extractor, device };
};

const getEmbeddingPipeline = async () => {
  if (embeddingPipelinePromise) {
    return embeddingPipelinePromise;
  }

  embeddingPipelinePromise = (async () => {
    const preferredDevice = getEmbeddingDevice();
    try {
      const { extractor, device } = await createEmbeddingPipeline(preferredDevice);
      embeddingBackend = device;
      return extractor;
    } catch (error) {
      if (preferredDevice === 'webgpu') {
        const { extractor, device } = await createEmbeddingPipeline('wasm');
        embeddingBackend = device;
        return extractor;
      }
      throw error;
    }
  })();

  try {
    return await embeddingPipelinePromise;
  } catch (error) {
    embeddingPipelinePromise = null;
    embeddingBackend = null;
    throw error;
  }
};

const prepareEmbeddingInputs = (sentences: SentenceSegment[]) =>
  sentences.map((sentence) => `passage: ${sentence.text}`);

type TensorLike = {
  data: ArrayLike<number>;
  dims: number[];
};

type TokenEmbeddingBatch = {
  data: Float32Array;
  batchSize: number;
  sequenceLength: number;
  hiddenSize: number;
};

const isNumberArrayLike = (value: unknown): value is ArrayLike<number> => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (!('length' in (value as { length?: unknown }))) {
    return false;
  }
  return Array.isArray(value) || ArrayBuffer.isView(value);
};

const toFloat32Array = (value: ArrayLike<number>) =>
  value instanceof Float32Array ? value : Float32Array.from(value, (entry) => Number(entry));

const isTensorLike = (value: unknown): value is TensorLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as { data?: unknown; dims?: unknown };
  if (!isNumberArrayLike(record.data)) {
    return false;
  }
  if (!Array.isArray(record.dims) || !record.dims.every((dim) => Number.isFinite(dim))) {
    return false;
  }
  return true;
};

const extractTokenEmbeddings = (value: unknown): TokenEmbeddingBatch | null => {
  if (isTensorLike(value)) {
    const dims = value.dims;
    if (dims.length === 3) {
      const [batchSize, sequenceLength, hiddenSize] = dims;
      if (!batchSize || !sequenceLength || !hiddenSize) {
        return null;
      }
      return { data: toFloat32Array(value.data), batchSize, sequenceLength, hiddenSize };
    }
    if (dims.length === 2) {
      const [sequenceLength, hiddenSize] = dims;
      if (!sequenceLength || !hiddenSize) {
        return null;
      }
      return { data: toFloat32Array(value.data), batchSize: 1, sequenceLength, hiddenSize };
    }
    return null;
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (Array.isArray(first) && first.length > 0) {
      const second = (first as unknown[])[0];
      if (Array.isArray(second)) {
        const batchSize = value.length;
        const sequenceLength = (first as unknown[]).length;
        const hiddenSize = (second as unknown[]).length;
        if (!batchSize || !sequenceLength || !hiddenSize) {
          return null;
        }
        const data = new Float32Array(batchSize * sequenceLength * hiddenSize);
        let offset = 0;
        for (const sentence of value as number[][][]) {
          for (const token of sentence) {
            for (const entry of token) {
              data[offset] = entry;
              offset += 1;
            }
          }
        }
        return { data, batchSize, sequenceLength, hiddenSize };
      }
      if (typeof second === 'number') {
        const sequenceLength = (value as number[][]).length;
        const hiddenSize = (first as number[]).length;
        if (!sequenceLength || !hiddenSize) {
          return null;
        }
        const data = new Float32Array(sequenceLength * hiddenSize);
        let offset = 0;
        for (const token of value as number[][]) {
          for (const entry of token) {
            data[offset] = entry;
            offset += 1;
          }
        }
        return { data, batchSize: 1, sequenceLength, hiddenSize };
      }
    }
  }

  return null;
};

const normalizeAttentionMask = (
  mask: unknown,
  batchSize: number,
  sequenceLength: number,
): number[][] | null => {
  if (!mask) {
    return null;
  }

  let rows: ArrayLike<number>[] | null = null;

  if (Array.isArray(mask)) {
    if (mask.length === 0) {
      return null;
    }
    const first = mask[0];
    if (Array.isArray(first) || ArrayBuffer.isView(first)) {
      rows = mask as ArrayLike<number>[];
    } else if (typeof first === 'number') {
      rows = [mask as ArrayLike<number>];
    }
  } else if (isNumberArrayLike(mask)) {
    rows = [mask];
  }

  if (!rows) {
    return null;
  }

  const normalized = rows.map((row) => {
    const values = Array.from(row, (entry) => Number(entry));
    if (values.length === sequenceLength) {
      return values;
    }
    if (values.length > sequenceLength) {
      return values.slice(0, sequenceLength);
    }
    return values.concat(Array(sequenceLength - values.length).fill(0));
  });

  if (!normalized.length) {
    return null;
  }
  if (normalized.length === 1 && batchSize > 1) {
    return Array.from({ length: batchSize }, () => normalized[0]);
  }
  if (normalized.length !== batchSize) {
    return null;
  }
  return normalized;
};

const getAttentionMask = async (
  extractor: EmbeddingPipeline,
  inputs: string[],
  batchSize: number,
  sequenceLength: number,
) => {
  if (typeof extractor.tokenizer !== 'function') {
    return null;
  }

  try {
    const tokenized = await extractor.tokenizer(inputs, { padding: true, truncation: true });
    return normalizeAttentionMask(tokenized.attention_mask, batchSize, sequenceLength);
  } catch (error) {
    console.debug('Unable to derive attention mask', error);
    return null;
  }
};

const meanPoolTokens = (
  data: Float32Array,
  tokenCount: number,
  hiddenSize: number,
  offset: number,
  attentionMask?: number[],
) => {
  const pooled = new Float32Array(hiddenSize);
  let activeTokens = 0;

  for (let tokenIndex = 0; tokenIndex < tokenCount; tokenIndex += 1) {
    const maskValue = attentionMask ? attentionMask[tokenIndex] : 1;
    if (!maskValue) {
      continue;
    }
    activeTokens += 1;
    const base = offset + tokenIndex * hiddenSize;
    for (let dim = 0; dim < hiddenSize; dim += 1) {
      pooled[dim] += data[base + dim];
    }
  }

  if (activeTokens === 0) {
    return pooled;
  }

  const scale = 1 / activeTokens;
  for (let dim = 0; dim < hiddenSize; dim += 1) {
    pooled[dim] *= scale;
  }
  return pooled;
};

const l2NormalizeInPlace = (vector: Float32Array) => {
  let sumSquares = 0;
  for (const value of vector) {
    sumSquares += value * value;
  }

  if (sumSquares === 0) {
    return vector;
  }

  const inverseNorm = 1 / Math.sqrt(sumSquares);
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] *= inverseNorm;
  }
  return vector;
};

const poolTokenEmbeddings = (
  batch: TokenEmbeddingBatch,
  attentionMask: number[][] | null,
) => {
  const { data, batchSize, sequenceLength, hiddenSize } = batch;
  const pooled: Float32Array[] = [];

  for (let batchIndex = 0; batchIndex < batchSize; batchIndex += 1) {
    const offset = batchIndex * sequenceLength * hiddenSize;
    const maskRow = attentionMask?.[batchIndex];
    const pooledVector = meanPoolTokens(data, sequenceLength, hiddenSize, offset, maskRow);
    pooled.push(l2NormalizeInPlace(pooledVector));
  }

  return pooled;
};

const computeEmbeddingsForSentences = async (sentences: SentenceSegment[]) => {
  if (!sentences.length) {
    return null;
  }

  const extractor = await getEmbeddingPipeline();
  const inputs = prepareEmbeddingInputs(sentences);
  const tokenEmbeddings = await extractor(inputs, { pooling: 'none' });

  const tokenBatch = extractTokenEmbeddings(tokenEmbeddings);
  if (!tokenBatch) {
    return null;
  }

  const attentionMask = await getAttentionMask(
    extractor,
    inputs,
    tokenBatch.batchSize,
    tokenBatch.sequenceLength,
  );

  return poolTokenEmbeddings(tokenBatch, attentionMask);
};

const cosineSimilarity = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  if (a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const valueA = a[index];
    const valueB = b[index];
    dot += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const runPageEmbeddings = async (sentences: SentenceSegment[], statusPrefix: string) => {
  if (!sentences.length) {
    return;
  }

  const requestId = ++embeddingRequestId;
  const preferredDevice = getEmbeddingDevice();
  setStatus(`${statusPrefix} Loading embeddings (${formatEmbeddingDeviceLabel(preferredDevice)})...`);

  try {
    const pooledEmbeddings = await computeEmbeddingsForSentences(sentences);
    if (requestId !== embeddingRequestId) {
      return;
    }
    if (!pooledEmbeddings) {
      setStatus(`${statusPrefix} Embeddings loaded but could not be parsed.`);
      return;
    }

    currentPageEmbeddings = pooledEmbeddings;
    updateAutoHighlights(currentPageSentences, currentPageEmbeddings);
    const highlightStats = renderHighlights();
    if (pooledEmbeddings.length > 1) {
      console.debug(
        'Embedding sample similarity',
        cosineSimilarity(pooledEmbeddings[0], pooledEmbeddings[1]).toFixed(4),
      );
    }
    if (currentPage) {
      const existing = indexedPages.get(currentPage.pageNumber);
      if (existing) {
        indexedPages.set(currentPage.pageNumber, {
          ...existing,
          highlights: currentPageHighlightSentences,
        });
      }
    }
    renderStudyStrip();
    const activeDevice = embeddingBackend ?? preferredDevice;
    setStatus(
      `${statusPrefix} Auto-highlighted ${highlightStats.sentences} sentences with embeddings (${formatEmbeddingDeviceLabel(activeDevice)}).`,
    );
  } catch (error) {
    if (requestId !== embeddingRequestId) {
      return;
    }
    console.error(error);
    setStatus(`${statusPrefix} Embeddings failed to load.`);
  }
};

const setStatus = (message: string) => {
  if (fileStatus) {
    fileStatus.textContent = message;
  }
};

const setFileName = (name: string) => {
  if (fileName) {
    fileName.textContent = name;
  }
};

const setExportEnabled = (enabled: boolean) => {
  if (downloadButton) {
    downloadButton.disabled = !enabled;
  }
};

const setPageIndicator = (current: number, total: number | null) => {
  if (!pageIndicator) {
    return;
  }
  pageIndicator.textContent = `Page ${current} / ${total ?? '-'}`;
};

const formatProgressCount = (completed: number, total: number) => `${completed} / ${total} pages`;

const getProgressPercent = (completed: number, total: number) => {
  if (!total || total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (completed / total) * 100));
};

const setProgress = (completed: number, total: number, message: string) => {
  if (progressCount) {
    progressCount.textContent = formatProgressCount(completed, total);
  }
  if (progressFill) {
    progressFill.style.width = `${getProgressPercent(completed, total)}%`;
  }
  if (progressStatus) {
    progressStatus.textContent = message;
  }
};

const resetProgress = () => {
  backgroundProcessedPages = 0;
  backgroundTotalPages = 0;
  setProgress(0, 0, 'Waiting for PDF upload.');
};

const resetViewer = () => {
  pdfDoc = null;
  currentPage = null;
  currentPageTextMap = null;
  currentPageSentences = [];
  currentPageEmbeddings = null;
  currentPageHighlightSentences = [];
  currentViewport = null;
  pdfBytes = null;
  currentFileName = null;
  embeddingRequestId += 1;
  backgroundProcessId += 1;
  indexedPages.clear();
  resetProgress();
  setExportEnabled(false);
  if (viewerStage) {
    viewerStage.classList.remove('is-ready');
  }
  if (viewerPlaceholder) {
    viewerPlaceholder.textContent = 'Page 1 will appear here after upload.';
  }
  if (pdfCanvas && pdfContext) {
    pdfContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
  }
  if (highlightLayer) {
    highlightLayer.innerHTML = '';
  }
  setPageIndicator(1, null);
  pinnedHighlightIds.clear();
  renderStudyStrip();
};

const isPdfTextItem = (item: PdfTextItem | PdfTextMarkedContent): item is PdfTextItem =>
  typeof (item as PdfTextItem).str === 'string';

const needsSyntheticSpace = (current: string, next: string) => {
  const lastChar = current.at(-1);
  const nextChar = next[0];
  if (!lastChar || !nextChar) {
    return false;
  }
  return !/\s/.test(lastChar) && !/\s/.test(nextChar);
};

const findNextTextItem = (items: PdfTextContent['items'], startIndex: number) => {
  for (let index = startIndex; index < items.length; index += 1) {
    const item = items[index];
    if (isPdfTextItem(item)) {
      return item;
    }
  }
  return null;
};

const getParagraphRanges = (fullText: string): ParagraphRange[] => {
  const ranges: ParagraphRange[] = [];
  const separatorRegex = /(?:\r?\n\s*){2,}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = separatorRegex.exec(fullText)) !== null) {
    const end = match.index;
    if (end > lastIndex) {
      ranges.push({ start: lastIndex, end });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < fullText.length) {
    ranges.push({ start: lastIndex, end: fullText.length });
  }

  return ranges;
};

const getFallbackSentenceChunks = (paragraphText: string): SegmentedTextChunk[] => {
  const chunks: SegmentedTextChunk[] = [];
  const regex = /[^.!?\n]+[.!?]+|[^.!?\n]+(?=\n|$)/g;

  for (const match of paragraphText.matchAll(regex)) {
    const text = match[0];
    if (!text) {
      continue;
    }
    chunks.push({ text, index: match.index ?? 0 });
  }

  if (!chunks.length && paragraphText) {
    chunks.push({ text: paragraphText, index: 0 });
  }

  return chunks;
};

const getSentenceChunks = (paragraphText: string): SegmentedTextChunk[] => {
  if (!sentenceSegmenter) {
    return getFallbackSentenceChunks(paragraphText);
  }

  return Array.from(sentenceSegmenter.segment(paragraphText), (segment) => ({
    text: segment.segment,
    index: segment.index,
  }));
};

const createSentenceId = (
  pageNumber: number,
  paragraphIndex: number,
  sentenceIndex: number,
  charStart: number,
  charEnd: number,
) => `p${pageNumber}-p${paragraphIndex}-s${sentenceIndex}-${charStart}-${charEnd}`;

const extractPageTextMap = async (page: PDFPageProxy): Promise<PageTextMap> => {
  const textContent = (await page.getTextContent()) as PdfTextContent;
  const items: PdfTextItem[] = [];
  const itemRanges: PdfTextItemRange[] = [];
  let fullText = '';

  for (let index = 0; index < textContent.items.length; index += 1) {
    const item = textContent.items[index];
    if (!isPdfTextItem(item)) {
      continue;
    }
    const text = item.str ?? '';
    const charStart = fullText.length;
    fullText += text;
    const charEnd = fullText.length;
    const itemIndex = items.length;
    items.push(item);
    itemRanges.push({ itemIndex, charStart, charEnd });

    if (item.hasEOL) {
      fullText += '\n';
      continue;
    }

    const nextTextItem = findNextTextItem(textContent.items, index + 1);
    if (nextTextItem && needsSyntheticSpace(text, nextTextItem.str)) {
      fullText += ' ';
    }
  }

  return { fullText, items, itemRanges };
};

const segmentPageText = (pageTextMap: PageTextMap, pageNumber: number): SentenceSegment[] => {
  const sentences: SentenceSegment[] = [];
  const paragraphRanges = getParagraphRanges(pageTextMap.fullText);
  let paragraphIndex = 0;

  for (const range of paragraphRanges) {
    const paragraphText = pageTextMap.fullText.slice(range.start, range.end);
    if (!paragraphText.trim()) {
      continue;
    }

    const sentenceChunks = getSentenceChunks(paragraphText);
    let sentenceIndex = 0;

    for (const chunk of sentenceChunks) {
      const rawText = chunk.text;
      const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
      const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
      const trimmedText = rawText.slice(leadingWhitespace, rawText.length - trailingWhitespace);

      if (!trimmedText) {
        continue;
      }

      const charStart = range.start + chunk.index + leadingWhitespace;
      const charEnd = range.start + chunk.index + rawText.length - trailingWhitespace;

      sentences.push({
        id: createSentenceId(pageNumber, paragraphIndex, sentenceIndex, charStart, charEnd),
        page: pageNumber,
        paragraphIndex,
        sentenceIndex,
        charStart,
        charEnd,
        text: trimmedText,
      });
      sentenceIndex += 1;
    }

    if (sentenceIndex > 0) {
      paragraphIndex += 1;
    }
  }

  return sentences;
};

type ScoredSentence = {
  sentence: SentenceSegment;
  embedding: Float32Array;
  score: number;
};

const getHighlightTargetCount = (sentenceCount: number) => {
  if (sentenceCount <= 0) {
    return 0;
  }
  const target = Math.min(maxHighlightSentences, Math.ceil(0.2 * sentenceCount));
  if (sentenceCount >= 2) {
    return Math.max(2, target);
  }
  return 1;
};

const computeCentroid = (embeddings: Float32Array[]) => {
  if (!embeddings.length) {
    return null;
  }
  const size = embeddings[0].length;
  const centroid = new Float32Array(size);
  for (const vector of embeddings) {
    for (let index = 0; index < size; index += 1) {
      centroid[index] += vector[index];
    }
  }
  const scale = 1 / embeddings.length;
  for (let index = 0; index < size; index += 1) {
    centroid[index] *= scale;
  }
  return l2NormalizeInPlace(centroid);
};

const getPositionPrior = (sentenceIndex: number, sentenceCount: number) => {
  if (sentenceCount <= 1) {
    return 0.6;
  }
  const ratio = sentenceIndex / sentenceCount;
  if (ratio <= 0.2) {
    return 1;
  }
  if (ratio <= 0.6) {
    return 0.6;
  }
  return 0.3;
};

const getLengthPrior = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const visibleMatches = trimmed.match(/\S/gu);
  const alphaMatches = trimmed.match(/[\p{L}\p{N}]/gu);
  const visibleCount = visibleMatches ? visibleMatches.length : 0;
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  const density = visibleCount ? alphaCount / visibleCount : 0;

  const length = trimmed.length;
  let lengthScore = 0;
  if (length < 20) {
    lengthScore = 0;
  } else if (length < 40) {
    lengthScore = 0.3;
  } else if (length < 80) {
    lengthScore = 0.6;
  } else {
    lengthScore = 1;
  }

  let densityScore = 0.1;
  if (density >= 0.6) {
    densityScore = 1;
  } else if (density >= 0.4) {
    densityScore = 0.7;
  } else if (density >= 0.25) {
    densityScore = 0.4;
  }

  return lengthScore * densityScore;
};

const buildSentenceScores = (
  sentences: SentenceSegment[],
  embeddings: Float32Array[],
) => {
  const pageCentroid = computeCentroid(embeddings);
  const docCentroid = pageCentroid;

  return sentences.map((sentence, index) => {
    const embedding = embeddings[index];
    const centrality = pageCentroid ? cosineSimilarity(embedding, pageCentroid) : 0;
    const globality = docCentroid ? cosineSimilarity(embedding, docCentroid) : 0;
    const position = getPositionPrior(index, sentences.length);
    const length = getLengthPrior(sentence.text);
    const score = 0.65 * centrality + 0.25 * globality + 0.07 * position + 0.03 * length;
    return { sentence, embedding, score };
  });
};

const selectHighlightsWithMmr = (
  candidates: ScoredSentence[],
  targetCount: number,
  lambda: number,
) => {
  const selected: ScoredSentence[] = [];
  const remaining = candidates.slice();

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      let penalty = 0;
      if (selected.length > 0) {
        let maxSimilarity = -Infinity;
        for (const picked of selected) {
          const similarity = cosineSimilarity(candidate.embedding, picked.embedding);
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
          }
        }
        penalty = lambda * maxSimilarity;
      }
      const value = candidate.score - penalty;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }

    selected.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }

  return selected;
};

const selectAutoHighlights = (
  sentences: SentenceSegment[],
  embeddings: Float32Array[] | null,
) => {
  const targetCount = getHighlightTargetCount(sentences.length);
  if (!targetCount) {
    return [];
  }

  if (!embeddings || embeddings.length !== sentences.length) {
    return sentences.slice(0, targetCount);
  }

  const candidates = buildSentenceScores(sentences, embeddings).sort(
    (a, b) => b.score - a.score,
  );
  const selected = selectHighlightsWithMmr(candidates, targetCount, highlightMmrLambda).map(
    (entry) => entry.sentence,
  );
  return selected.length > 0 ? selected : sentences.slice(0, targetCount);
};

const updateAutoHighlights = (
  sentences: SentenceSegment[],
  embeddings: Float32Array[] | null,
) => {
  currentPageHighlightSentences = selectAutoHighlights(sentences, embeddings);
  return currentPageHighlightSentences.length;
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  endA > startB && startA < endB;

const getItemViewportRect = (
  item: PdfTextItem,
  viewport: ReturnType<PDFPageProxy['getViewport']>,
) => {
  const [x, y] = item.transform.slice(4, 6);
  const rect = viewport.convertToViewportRectangle([x, y, x + item.width, y + item.height]);
  const left = Math.min(rect[0], rect[2]);
  const top = Math.min(rect[1], rect[3]);
  const width = Math.abs(rect[0] - rect[2]);
  const height = Math.abs(rect[1] - rect[3]);

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null;
  }
  if (width <= 0 || height <= 0) {
    return null;
  }

  return { left, top, width, height };
};

const getItemPdfRect = (
  item: PdfTextItem,
  viewport: ReturnType<PDFPageProxy['getViewport']>,
): PdfRect | null => {
  const rect = getItemViewportRect(item, viewport);
  if (!rect) {
    return null;
  }

  const pdfPointConverter = (viewport as { convertToPdfPoint?: (x: number, y: number) => [number, number] })
    .convertToPdfPoint;
  if (typeof pdfPointConverter === 'function') {
    const [x1, y1] = pdfPointConverter(rect.left, rect.top);
    const [x2, y2] = pdfPointConverter(rect.left + rect.width, rect.top + rect.height);
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
      return null;
    }
    return { x, y, width, height };
  }

  const scale = (viewport as { scale?: number }).scale ?? 1;
  const pageHeight = viewport.height / scale;
  const x = rect.left / scale;
  const y = pageHeight - (rect.top + rect.height) / scale;
  const width = rect.width / scale;
  const height = rect.height / scale;
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
};

const renderHighlights = () => {
  if (!highlightLayer || !currentViewport || !currentPageTextMap) {
    if (highlightLayer) {
      highlightLayer.innerHTML = '';
    }
    return { sentences: 0, rects: 0 };
  }

  const fallbackCount = getHighlightTargetCount(currentPageSentences.length);
  const highlightSentences =
    currentPageHighlightSentences.length > 0
      ? currentPageHighlightSentences
      : currentPageSentences.slice(0, fallbackCount);
  if (!highlightSentences.length) {
    highlightLayer.innerHTML = '';
    return { sentences: 0, rects: 0 };
  }

  const fragment = document.createDocumentFragment();
  let rectCount = 0;

  for (const sentence of highlightSentences) {
    const overlappingItems = currentPageTextMap.itemRanges.filter((range) =>
      rangesOverlap(range.charStart, range.charEnd, sentence.charStart, sentence.charEnd),
    );

    for (const range of overlappingItems) {
      const item = currentPageTextMap.items[range.itemIndex];
      const rect = getItemViewportRect(item, currentViewport);
      if (!rect) {
        continue;
      }

      const rectEl = document.createElement('div');
      rectEl.className = 'highlight-rect';
      rectEl.style.left = `${rect.left}px`;
      rectEl.style.top = `${rect.top}px`;
      rectEl.style.width = `${rect.width}px`;
      rectEl.style.height = `${rect.height}px`;
      rectEl.dataset.sentenceId = sentence.id;
      fragment.append(rectEl);
      rectCount += 1;
    }
  }

  highlightLayer.innerHTML = '';
  highlightLayer.append(fragment);

  return { sentences: highlightSentences.length, rects: rectCount };
};

const getPageHighlightSentences = (entry: IndexedPage) => {
  if (entry.highlights && entry.highlights.length > 0) {
    return entry.highlights;
  }
  const fallbackCount = getHighlightTargetCount(entry.sentences.length);
  if (!fallbackCount) {
    return [];
  }
  return entry.sentences.slice(0, fallbackCount);
};

const sortHighlightsByPosition = (a: SentenceSegment, b: SentenceSegment) => {
  if (a.paragraphIndex !== b.paragraphIndex) {
    return a.paragraphIndex - b.paragraphIndex;
  }
  if (a.sentenceIndex !== b.sentenceIndex) {
    return a.sentenceIndex - b.sentenceIndex;
  }
  return a.charStart - b.charStart;
};

const buildStudyStripSections = () =>
  Array.from(indexedPages.values())
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((entry) => ({
      pageNumber: entry.pageNumber,
      highlights: getPageHighlightSentences(entry).slice().sort(sortHighlightsByPosition),
    }))
    .filter((section) => section.highlights.length > 0);

const updateStudyStripSummary = (pinnedCount: number, totalCount: number) => {
  if (!studyStripCount) {
    return;
  }
  if (totalCount === 0) {
    studyStripCount.textContent = '0 pinned';
    studyStripCount.title = 'No highlights yet';
    return;
  }
  studyStripCount.textContent = `${pinnedCount} pinned`;
  studyStripCount.title = `${totalCount} highlighted lines`;
};

const renderStudyStrip = () => {
  if (!studyStripList || !studyStripEmpty) {
    return;
  }

  studyStripList.innerHTML = '';
  const sections = buildStudyStripSections();
  const fragment = document.createDocumentFragment();
  const activeIds = new Set<string>();
  let totalHighlights = 0;
  let totalPinned = 0;

  for (const section of sections) {
    const groupEl = document.createElement('div');
    groupEl.className = 'strip-group';

    const headerEl = document.createElement('div');
    headerEl.className = 'strip-group-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'strip-group-title';
    titleEl.textContent = `Page ${section.pageNumber}`;

    const metaEl = document.createElement('span');
    metaEl.className = 'strip-group-meta';

    const itemsEl = document.createElement('div');
    itemsEl.className = 'strip-items';

    let pinnedInGroup = 0;

    for (const sentence of section.highlights) {
      totalHighlights += 1;
      activeIds.add(sentence.id);
      const isPinned = pinnedHighlightIds.has(sentence.id);
      if (isPinned) {
        totalPinned += 1;
        pinnedInGroup += 1;
      }

      const itemEl = document.createElement('div');
      itemEl.className = `strip-item${isPinned ? ' pinned' : ''}`;

      const textEl = document.createElement('p');
      textEl.className = 'strip-text';
      textEl.textContent = sentence.text;

      const pinButton = document.createElement('button');
      pinButton.type = 'button';
      pinButton.className = 'strip-pin';
      pinButton.dataset.sentenceId = sentence.id;
      pinButton.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
      pinButton.textContent = isPinned ? 'Unpin' : 'Pin';

      itemEl.append(textEl, pinButton);
      itemsEl.append(itemEl);
    }

    metaEl.textContent =
      pinnedInGroup > 0
        ? `${pinnedInGroup} pinned, ${section.highlights.length} lines`
        : `${section.highlights.length} lines`;

    headerEl.append(titleEl, metaEl);
    groupEl.append(headerEl, itemsEl);
    fragment.append(groupEl);
  }

  for (const id of Array.from(pinnedHighlightIds)) {
    if (!activeIds.has(id)) {
      pinnedHighlightIds.delete(id);
    }
  }

  updateStudyStripSummary(totalPinned, totalHighlights);

  if (!sections.length) {
    studyStripEmpty.textContent =
      indexedPages.size === 0
        ? 'Upload a PDF to populate the study strip.'
        : 'No highlights available yet.';
    studyStripEmpty.hidden = false;
    studyStripList.hidden = true;
    return;
  }

  studyStripEmpty.hidden = true;
  studyStripList.hidden = false;
  studyStripList.append(fragment);
};

const togglePinnedHighlight = (sentenceId: string) => {
  if (pinnedHighlightIds.has(sentenceId)) {
    pinnedHighlightIds.delete(sentenceId);
  } else {
    pinnedHighlightIds.add(sentenceId);
  }
  renderStudyStrip();
};

const collectHighlightRects = (
  textMap: PageTextMap,
  highlightSentences: SentenceSegment[],
  viewport: ReturnType<PDFPageProxy['getViewport']>,
) => {
  const rects: PdfRect[] = [];
  for (const sentence of highlightSentences) {
    const overlappingItems = textMap.itemRanges.filter((range) =>
      rangesOverlap(range.charStart, range.charEnd, sentence.charStart, sentence.charEnd),
    );

    for (const range of overlappingItems) {
      const item = textMap.items[range.itemIndex];
      const rect = getItemPdfRect(item, viewport);
      if (!rect) {
        continue;
      }
      rects.push(rect);
    }
  }
  return rects;
};

const getDownloadFileName = (name: string | null) => {
  if (!name) {
    return 'highlighted.pdf';
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return 'highlighted.pdf';
  }
  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return `highlighted-${trimmed}`;
  }
  return `highlighted-${trimmed}.pdf`;
};

const exportHighlightedPdf = async () => {
  if (!pdfDoc || !pdfBytes) {
    setStatus('Upload a PDF first to export highlights.');
    return;
  }

  if (indexedPages.size === 0) {
    setStatus('Highlights are not ready yet.');
    return;
  }

  setExportEnabled(false);
  const totalPages = pdfDoc.numPages;
  const processedPages = indexedPages.size;
  if (processedPages < totalPages) {
    setStatus(`Exporting highlights for ${processedPages} of ${totalPages} pages...`);
  } else {
    setStatus('Exporting highlighted PDF...');
  }

  try {
    const { PDFDocument, rgb } = await import('pdf-lib');
    const pdfDocument = await PDFDocument.load(pdfBytes);
    const pdfPages = pdfDocument.getPages();
    const entries = Array.from(indexedPages.values()).sort((a, b) => a.pageNumber - b.pageNumber);

    for (const entry of entries) {
      if (entry.pageNumber < 1 || entry.pageNumber > pdfPages.length) {
        continue;
      }
      const pdfjsPage = await pdfDoc.getPage(entry.pageNumber);
      const viewport = pdfjsPage.getViewport({ scale: 1 });
      const highlightSentences = getPageHighlightSentences(entry);
      if (highlightSentences.length === 0) {
        continue;
      }
      const rects = collectHighlightRects(entry.textMap, highlightSentences, viewport);
      if (!rects.length) {
        continue;
      }
      const pdfPage = pdfPages[entry.pageNumber - 1];
      for (const rect of rects) {
        pdfPage.drawRectangle({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          color: rgb(1, 0.9, 0.2),
          opacity: 0.35,
        });
      }
    }

    const outputBytes = await pdfDocument.save();
    const blob = new Blob([outputBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getDownloadFileName(currentFileName);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Highlighted PDF ready for download.');
  } catch (error) {
    console.error(error);
    setStatus('Failed to export highlighted PDF.');
  } finally {
    setExportEnabled(true);
  }
};

const indexPdfPage = async (
  doc: PDFDocumentProxy,
  pageNumber: number,
  processId: number,
): Promise<IndexedPage | null> => {
  const page = await doc.getPage(pageNumber);
  if (processId !== backgroundProcessId) {
    return null;
  }

  const textMap = await extractPageTextMap(page);
  if (processId !== backgroundProcessId) {
    return null;
  }

  const sentences = segmentPageText(textMap, pageNumber);
  let embeddings: Float32Array[] | null = null;

  if (sentences.length) {
    try {
      embeddings = await computeEmbeddingsForSentences(sentences);
    } catch (error) {
      console.debug('Embedding failed for page', pageNumber, error);
    }
    if (processId !== backgroundProcessId) {
      return null;
    }
  }

  const highlights = selectAutoHighlights(sentences, embeddings);
  return { pageNumber, textMap, sentences, highlights };
};

const startBackgroundIndexing = async (
  doc: PDFDocumentProxy,
  processId: number,
  startPage: number,
  waitFor?: Promise<void>,
) => {
  if (waitFor) {
    try {
      await waitFor;
    } catch (error) {
      console.debug('Page 1 embeddings failed', error);
    }
  }

  if (processId !== backgroundProcessId) {
    return;
  }

  const totalPages = doc.numPages;
  backgroundTotalPages = totalPages;

  if (totalPages <= 1 || startPage > totalPages) {
    setProgress(backgroundProcessedPages, backgroundTotalPages, 'All pages indexed.');
    return;
  }

  for (let pageNumber = startPage; pageNumber <= totalPages; pageNumber += 1) {
    if (processId !== backgroundProcessId) {
      return;
    }

    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      `Indexing page ${pageNumber} of ${totalPages}...`,
    );

    try {
      const entry = await indexPdfPage(doc, pageNumber, processId);
      if (!entry) {
        return;
      }
      indexedPages.set(pageNumber, entry);
      renderStudyStrip();
    } catch (error) {
      console.error('Failed to index page', pageNumber, error);
    }

    backgroundProcessedPages = Math.min(totalPages, backgroundProcessedPages + 1);
    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      `Indexed ${backgroundProcessedPages} of ${totalPages} pages.`,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
};

const renderPage = async (page: PDFPageProxy) => {
  if (!viewerStage || !pdfCanvas || !pdfContext) {
    return;
  }

  renderTask?.cancel();
  const baseViewport = page.getViewport({ scale: 1 });
  const stagePadding = 48;
  const containerWidth = Math.max(280, viewerStage.clientWidth - stagePadding);
  const scale = Math.min(2.2, containerWidth / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  currentViewport = viewport;

  pdfCanvas.width = Math.floor(viewport.width * outputScale);
  pdfCanvas.height = Math.floor(viewport.height * outputScale);
  pdfCanvas.style.width = `${viewport.width}px`;
  pdfCanvas.style.height = `${viewport.height}px`;
  if (pdfStack) {
    pdfStack.style.width = `${viewport.width}px`;
    pdfStack.style.height = `${viewport.height}px`;
  }

  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
  renderTask = page.render({ canvasContext: pdfContext, viewport, transform });

  try {
    await renderTask.promise;
  } catch (error) {
    if ((error as { name?: string }).name !== 'RenderingCancelledException') {
      throw error;
    }
  } finally {
    renderTask = null;
  }
};

const loadPdf = async (file: File) => {
  if (!file.type.includes('pdf')) {
    setStatus('That file is not a PDF. Please choose a .pdf file.');
    return;
  }

  resetViewer();
  setFileName(file.name);
  currentFileName = file.name;
  setStatus('Loading PDF...');
  const processId = backgroundProcessId;

  try {
    const buffer = await file.arrayBuffer();
    pdfBytes = buffer;
    pdfDoc?.destroy();
    const loadingTask = getDocument({ data: buffer });
    pdfDoc = await loadingTask.promise;
    currentPage = await pdfDoc.getPage(1);
    setPageIndicator(1, pdfDoc.numPages);
    backgroundTotalPages = pdfDoc.numPages;
    backgroundProcessedPages = 0;
    setProgress(0, backgroundTotalPages, `Preparing page 1 of ${pdfDoc.numPages}...`);
    if (viewerStage) {
      viewerStage.classList.add('is-ready');
    }
    setStatus(`Rendering page 1 of ${pdfDoc.numPages}...`);
    await renderPage(currentPage);
    currentPageTextMap = await extractPageTextMap(currentPage);
    currentPageSentences = segmentPageText(currentPageTextMap, currentPage.pageNumber);
    updateAutoHighlights(currentPageSentences, null);
    indexedPages.set(currentPage.pageNumber, {
      pageNumber: currentPage.pageNumber,
      textMap: currentPageTextMap,
      sentences: currentPageSentences,
      highlights: currentPageHighlightSentences,
    });
    setExportEnabled(true);
    const highlightStats = renderHighlights();
    renderStudyStrip();
    const statusPrefix = `Rendered page 1 of ${pdfDoc.numPages}. Extracted ${currentPageTextMap.items.length} text items, ${currentPageSentences.length} sentences.`;
    setStatus(`${statusPrefix} Highlighted ${highlightStats.sentences} sentences.`);
    backgroundProcessedPages = 1;
    const progressMessage =
      pdfDoc.numPages > 1
        ? 'Page 1 ready. Indexing remaining pages...'
        : 'Single-page PDF ready.';
    setProgress(backgroundProcessedPages, backgroundTotalPages, progressMessage);
    const embeddingsTask = runPageEmbeddings(currentPageSentences, statusPrefix);
    void startBackgroundIndexing(pdfDoc, processId, 2, embeddingsTask);
  } catch (error) {
    console.error(error);
    setStatus('Unable to render this PDF. Try another file.');
    setProgress(backgroundProcessedPages, backgroundTotalPages, 'PDF rendering failed.');
    if (viewerPlaceholder) {
      viewerPlaceholder.textContent = 'Rendering failed. Upload another PDF.';
    }
  }
};

pdfInput?.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  void loadPdf(file);
  target.value = '';
});

dropzone?.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('is-dragover');
});

dropzone?.addEventListener('dragleave', () => {
  dropzone.classList.remove('is-dragover');
});

dropzone?.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-dragover');
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }
  void loadPdf(file);
});

downloadButton?.addEventListener('click', () => {
  void exportHighlightedPdf();
});

studyStripList?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('button[data-sentence-id]');
  if (!button) {
    return;
  }
  const sentenceId = button.dataset.sentenceId;
  if (!sentenceId) {
    return;
  }
  togglePinnedHighlight(sentenceId);
});

window.addEventListener('resize', () => {
  if (!currentPage) {
    return;
  }
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    void renderPage(currentPage).then(() => {
      renderHighlights();
    });
  }, 150);
});

renderStudyStrip();
