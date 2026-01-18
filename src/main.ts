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
      <h1>Drop a PDF or Word doc. Paste a URL or text. See page 1 instantly.</h1>
      <p class="lede">
        Upload a PDF to render page 1 with highlights, open a DOCX for a clean reading view, fetch a URL, or paste text.
      </p>
    </header>
    <section class="stage">
      <article class="upload-card">
        <div>
          <h2>Document upload</h2>
          <p class="muted">
            PDFs render page 1 with highlights. DOCX files open a sanitized reading view. URLs fetch through r.jina.ai.
            Paste text for a private reading view.
          </p>
        </div>
        <div class="upload-options">
          <label class="dropzone" id="pdf-dropzone" for="pdf-input">
            <input id="pdf-input" type="file" accept="application/pdf" />
            <span class="dropzone-title">Choose a PDF</span>
            <span class="dropzone-subtitle">or drag & drop here</span>
          </label>
          <label class="dropzone" id="docx-dropzone" for="docx-input">
            <input
              id="docx-input"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
            <span class="dropzone-title">Choose a Word (.docx)</span>
            <span class="dropzone-subtitle">opens a clean reading view</span>
          </label>
        </div>
        <div class="url-panel">
          <label class="url-label" for="url-input">Paste a URL</label>
          <div class="url-row">
            <input
              id="url-input"
              class="url-input"
              type="url"
              placeholder="https://example.com/article"
              inputmode="url"
              autocomplete="url"
            />
            <button id="url-fetch" class="secondary-button" type="button">Fetch URL</button>
          </div>
          <p class="muted url-note">Fetched through r.jina.ai for readability.</p>
        </div>
        <div class="text-panel">
          <label class="url-label" for="text-input">Paste text</label>
          <textarea
            id="text-input"
            class="text-input"
            rows="6"
            placeholder="Paste or type your reading here"
          ></textarea>
          <div class="text-actions">
            <button id="text-render" class="secondary-button" type="button">Render text</button>
            <span class="muted text-hint">Tip: Press Ctrl or Cmd + Enter to render.</span>
          </div>
        </div>
        <div class="upload-meta">
          <p id="file-name" class="meta-line">No file selected.</p>
          <p id="file-status" class="meta-line">Upload a PDF, DOCX, URL, or paste text to get started.</p>
        </div>
      </article>
      <article class="viewer-card">
        <div class="viewer-header">
          <div>
            <h2>Page preview</h2>
            <p class="muted">PDF.js canvas render or reading view</p>
          </div>
          <span id="page-indicator" class="pill">Page 1 / -</span>
        </div>
        <div class="highlight-controls" aria-label="Highlight controls">
          <div class="control-group">
            <p class="control-label">Highlight mode</p>
            <div class="segmented-control" role="group" aria-label="Highlight mode">
              <button
                class="segment-button"
                type="button"
                data-highlight-mode="auto"
                aria-pressed="true"
              >
                Auto
              </button>
              <button
                class="segment-button"
                type="button"
                data-highlight-mode="question"
                aria-pressed="false"
                aria-disabled="true"
                disabled
              >
                Question
              </button>
            </div>
            <p id="mode-note" class="muted control-note">Question mode is coming soon.</p>
          </div>
          <div class="control-group">
            <p class="control-label">Intensity</p>
            <div class="segmented-control" role="group" aria-label="Highlight intensity">
              <button
                class="segment-button"
                type="button"
                data-highlight-intensity="less"
                aria-pressed="false"
              >
                Less
              </button>
              <button
                class="segment-button"
                type="button"
                data-highlight-intensity="default"
                aria-pressed="true"
              >
                Default
              </button>
              <button
                class="segment-button"
                type="button"
                data-highlight-intensity="more"
                aria-pressed="false"
              >
                More
              </button>
            </div>
            <p id="intensity-note" class="muted control-note">Balanced coverage for typical study loads.</p>
          </div>
        </div>
        <div id="viewer-stage" class="viewer-stage">
          <div id="viewer-placeholder" class="viewer-placeholder">
            Document preview will appear here after upload.
          </div>
          <div id="pdf-stack" class="pdf-stack" aria-hidden="true">
            <canvas id="pdf-canvas" class="pdf-canvas" aria-label="PDF page preview"></canvas>
            <div id="highlight-layer" class="highlight-layer"></div>
          </div>
          <div id="docx-viewer" class="docx-viewer" aria-live="polite"></div>
        </div>
        <div class="progress-panel" aria-live="polite">
          <div class="progress-meta">
            <span class="progress-title">Background indexing</span>
            <span id="progress-count" class="progress-count">0 / 0 pages</span>
          </div>
          <div class="progress-bar">
            <div id="progress-fill" class="progress-fill"></div>
          </div>
          <p id="progress-status" class="muted progress-status">Waiting for document upload.</p>
        </div>
        <div class="export-panel">
          <button id="download-highlighted" class="primary-button" type="button" disabled>
            Download highlighted PDF
          </button>
          <p id="export-note" class="muted export-note">Embeds highlight rectangles into the original PDF.</p>
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
      <div class="strip-actions">
        <div class="strip-action-row">
          <button id="study-strip-copy" class="strip-action" type="button" disabled>Copy highlights</button>
          <button id="study-strip-download" class="strip-action" type="button" disabled>
            Download highlights.md
          </button>
        </div>
        <p id="study-strip-export-note" class="muted strip-export-note">
          Exports pinned lines when available, otherwise all highlights.
        </p>
      </div>
      <div id="study-strip-list" class="strip-list" role="list"></div>
      <p id="study-strip-empty" class="muted strip-empty">Upload a PDF, DOCX, URL, or text to populate the study strip.</p>
    </section>
  </main>
`;

const pdfInput = document.querySelector<HTMLInputElement>('#pdf-input');
const docxInput = document.querySelector<HTMLInputElement>('#docx-input');
const urlInput = document.querySelector<HTMLInputElement>('#url-input');
const urlFetchButton = document.querySelector<HTMLButtonElement>('#url-fetch');
const textInput = document.querySelector<HTMLTextAreaElement>('#text-input');
const textRenderButton = document.querySelector<HTMLButtonElement>('#text-render');
const pdfDropzone = document.querySelector<HTMLLabelElement>('#pdf-dropzone');
const docxDropzone = document.querySelector<HTMLLabelElement>('#docx-dropzone');
const fileName = document.querySelector<HTMLParagraphElement>('#file-name');
const fileStatus = document.querySelector<HTMLParagraphElement>('#file-status');
const pageIndicator = document.querySelector<HTMLSpanElement>('#page-indicator');
const viewerStage = document.querySelector<HTMLDivElement>('#viewer-stage');
const viewerPlaceholder = document.querySelector<HTMLDivElement>('#viewer-placeholder');
const pdfStack = document.querySelector<HTMLDivElement>('#pdf-stack');
const pdfCanvas = document.querySelector<HTMLCanvasElement>('#pdf-canvas');
const pdfContext = pdfCanvas?.getContext('2d');
const highlightLayer = document.querySelector<HTMLDivElement>('#highlight-layer');
const docxViewer = document.querySelector<HTMLDivElement>('#docx-viewer');
const progressStatus = document.querySelector<HTMLParagraphElement>('#progress-status');
const progressCount = document.querySelector<HTMLSpanElement>('#progress-count');
const progressFill = document.querySelector<HTMLDivElement>('#progress-fill');
const downloadButton = document.querySelector<HTMLButtonElement>('#download-highlighted');
const exportNote = document.querySelector<HTMLParagraphElement>('#export-note');
const studyStripList = document.querySelector<HTMLDivElement>('#study-strip-list');
const studyStripEmpty = document.querySelector<HTMLParagraphElement>('#study-strip-empty');
const studyStripCount = document.querySelector<HTMLSpanElement>('#study-strip-count');
const studyStripCopyButton = document.querySelector<HTMLButtonElement>('#study-strip-copy');
const studyStripDownloadButton = document.querySelector<HTMLButtonElement>('#study-strip-download');
const studyStripExportNote = document.querySelector<HTMLParagraphElement>('#study-strip-export-note');
const highlightModeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-highlight-mode]'),
);
const highlightModeNote = document.querySelector<HTMLParagraphElement>('#mode-note');
const highlightIntensityButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-highlight-intensity]'),
);
const highlightIntensityNote = document.querySelector<HTMLParagraphElement>('#intensity-note');

let pdfDoc: PDFDocumentProxy | null = null;
let currentPage: PDFPageProxy | null = null;
let renderTask: RenderTask | null = null;
let resizeTimer: number | undefined;
let currentViewport: ReturnType<PDFPageProxy['getViewport']> | null = null;
let pdfBytes: ArrayBuffer | null = null;
let currentFileName: string | null = null;
const pinnedHighlightIds = new Set<string>();
type DocumentSourceKind = 'pdf' | 'docx' | 'url' | 'text' | null;
let currentSourceKind: DocumentSourceKind = null;
type ReadingSourceKind = 'docx' | 'url' | 'text';
type HighlightMode = 'auto' | 'question';
type HighlightIntensity = 'less' | 'default' | 'more';

type IndexedPage =
  | {
      source: 'pdf';
      pageNumber: number;
      textMap: PageTextMap;
      sentences: SentenceSegment[];
      highlights: SentenceSegment[];
      embeddings: Float32Array[] | null;
    }
  | {
      source: ReadingSourceKind;
      pageNumber: number;
      sentences: SentenceSegment[];
      highlights: SentenceSegment[];
      embeddings: Float32Array[] | null;
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

type DocxBlock = {
  element: HTMLElement;
  text: string;
  charStart: number;
  charEnd: number;
  paragraphIndex: number;
};

type DocxPage = {
  pageNumber: number;
  element: HTMLDivElement;
  content: HTMLDivElement;
};

type DocxPageTextMap = {
  fullText: string;
  blocks: DocxBlock[];
};

type Html2CanvasRenderer = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

type StudyStripSection = {
  pageNumber: number;
  highlights: SentenceSegment[];
};

type StudyStripExportMode = 'pinned' | 'all';

type StudyStripExportPayload = {
  mode: StudyStripExportMode;
  sections: StudyStripSection[];
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
const highlightIntensitySettings: Record<
  HighlightIntensity,
  { ratio: number; max: number; min: number; note: string; label: string }
> = {
  less: {
    ratio: 0.12,
    max: 3,
    min: 1,
    note: 'Fewer highlights per page.',
    label: 'Less',
  },
  default: {
    ratio: 0.2,
    max: 6,
    min: 2,
    note: 'Balanced coverage for typical study loads.',
    label: 'Default',
  },
  more: {
    ratio: 0.3,
    max: 9,
    min: 3,
    note: 'More highlights for dense passages.',
    label: 'More',
  },
};
let currentHighlightIntensity: HighlightIntensity = 'default';
let currentHighlightMode: HighlightMode = 'auto';
const highlightMmrLambda = 0.35;
let embeddingPipelinePromise: Promise<EmbeddingPipeline> | null = null;
let embeddingBackend: EmbeddingDevice | null = null;
let embeddingRequestId = 0;
let currentPageEmbeddings: Float32Array[] | null = null;
let currentPageHighlightSentences: SentenceSegment[] = [];
let docxHtml: string | null = null;
let docxPages: DocxPage[] = [];
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
          embeddings: currentPageEmbeddings,
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

const getExportNote = (mode: DocumentSourceKind) => {
  if (mode === 'pdf') {
    return 'Embeds highlight rectangles into the original PDF.';
  }
  if (mode === 'docx') {
    return 'Generates a highlighted PDF from the reading view; layout may differ from the original DOCX.';
  }
  if (mode === 'url') {
    return 'Generates a highlighted PDF from the reading view; layout may differ from the original web page.';
  }
  if (mode === 'text') {
    return 'Generates a highlighted PDF from the reading view of your pasted text.';
  }
  return 'Upload a document to enable export.';
};

const setExportNote = (mode: DocumentSourceKind) => {
  if (!exportNote) {
    return;
  }
  exportNote.textContent = getExportNote(mode);
};

const setPageIndicator = (current: number, total: number | null) => {
  if (!pageIndicator) {
    return;
  }
  pageIndicator.textContent = `Page ${current} / ${total ?? '-'}`;
};

const setPageIndicatorLabel = (label: string) => {
  if (!pageIndicator) {
    return;
  }
  pageIndicator.textContent = label;
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

const setViewerMode = (mode: DocumentSourceKind) => {
  currentSourceKind = mode;
  if (!viewerStage) {
    return;
  }
  viewerStage.classList.toggle('is-ready', mode !== null);
  viewerStage.classList.toggle('is-docx', mode === 'docx' || mode === 'url' || mode === 'text');
  setExportNote(mode);
};

const resetProgress = () => {
  backgroundProcessedPages = 0;
  backgroundTotalPages = 0;
  setProgress(0, 0, 'Waiting for document upload.');
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
  docxHtml = null;
  docxPages = [];
  embeddingRequestId += 1;
  backgroundProcessId += 1;
  indexedPages.clear();
  resetProgress();
  setExportEnabled(false);
  setViewerMode(null);
  if (viewerPlaceholder) {
    viewerPlaceholder.textContent = 'Document preview will appear here after upload.';
  }
  if (docxViewer) {
    docxViewer.innerHTML = '';
    docxViewer.scrollTop = 0;
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

const isDocxFile = (file: File) => {
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return true;
  }
  return file.name.toLowerCase().endsWith('.docx');
};

const sanitizeDocxHref = (href: string) => {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('#')) {
    return trimmed;
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith('javascript:') || lowered.startsWith('data:')) {
    return null;
  }
  try {
    const url = new URL(trimmed, window.location.origin);
    const allowed = new Set(['http:', 'https:', 'mailto:', 'tel:']);
    if (allowed.has(url.protocol)) {
      return url.href;
    }
  } catch (error) {
    return null;
  }
  return null;
};

const sanitizeDocxHtml = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blockedTags = new Set([
    'script',
    'style',
    'link',
    'meta',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
    'svg',
    'math',
    'img',
    'video',
    'audio',
    'canvas',
  ]);

  const elements = Array.from(doc.body.querySelectorAll('*'));
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (blockedTags.has(tag)) {
      element.remove();
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
        continue;
      }
      if (tag === 'a' && name === 'href') {
        const safeHref = sanitizeDocxHref(attr.value);
        if (!safeHref) {
          element.removeAttribute(attr.name);
        } else {
          element.setAttribute('href', safeHref);
          element.setAttribute('rel', 'noreferrer noopener');
          element.setAttribute('target', '_blank');
        }
        continue;
      }
      if ((tag === 'td' || tag === 'th') && (name === 'colspan' || name === 'rowspan')) {
        if (!/^\d+$/.test(attr.value)) {
          element.removeAttribute(attr.name);
        }
        continue;
      }
      element.removeAttribute(attr.name);
    }
  }

  return doc.body.innerHTML.trim();
};

const getReadingLabel = (sourceKind: ReadingSourceKind) => {
  if (sourceKind === 'url') {
    return 'URL';
  }
  if (sourceKind === 'text') {
    return 'Text';
  }
  return 'DOCX';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeHtmlAttribute = (value: string) => escapeHtml(value);

const sanitizeUrlHref = (href: string, baseUrl: URL | null) => {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('#')) {
    return trimmed;
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith('javascript:') || lowered.startsWith('data:')) {
    return null;
  }
  try {
    const url = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    const allowed = new Set(['http:', 'https:', 'mailto:', 'tel:']);
    if (allowed.has(url.protocol)) {
      return url.href;
    }
  } catch (error) {
    return null;
  }
  return null;
};

const renderInlineMarkdown = (input: string, baseUrl: URL | null) => {
  const codeTokens: string[] = [];
  const linkTokens: string[] = [];

  let working = input.replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE${codeTokens.length}@@`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  working = working.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const safeHref = sanitizeUrlHref(href, baseUrl);
    const token = `@@LINK${linkTokens.length}@@`;
    if (!safeHref) {
      linkTokens.push(escapeHtml(label));
      return token;
    }
    const safeLabel = escapeHtml(label);
    const safeHrefValue = escapeHtmlAttribute(safeHref);
    linkTokens.push(
      `<a href="${safeHrefValue}" target="_blank" rel="noreferrer noopener">${safeLabel}</a>`,
    );
    return token;
  });

  let escaped = escapeHtml(working);
  escaped = escaped.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
  escaped = escaped.replace(/(\*|_)([^*_]+)\1/g, '<em>$2</em>');

  codeTokens.forEach((tokenValue, index) => {
    escaped = escaped.split(`@@CODE${index}@@`).join(tokenValue);
  });
  linkTokens.forEach((tokenValue, index) => {
    escaped = escaped.split(`@@LINK${index}@@`).join(tokenValue);
  });

  return escaped;
};

// Minimal markdown rendering for r.jina.ai responses.
const renderMarkdownToHtml = (markdown: string, baseUrl: URL | null) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let quoteLines: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }
    const text = paragraphLines.join(' ').trim();
    if (text) {
      output.push(`<p>${renderInlineMarkdown(text, baseUrl)}</p>`);
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) {
      listType = null;
      listItems = [];
      return;
    }
    const items = listItems.map((item) => `<li>${renderInlineMarkdown(item, baseUrl)}</li>`).join('');
    output.push(`<${listType}>${items}</${listType}>`);
    listType = null;
    listItems = [];
  };

  const flushQuote = () => {
    if (!quoteLines.length) {
      return;
    }
    const body = quoteLines
      .map((line) => `<p>${renderInlineMarkdown(line, baseUrl)}</p>`)
      .join('');
    output.push(`<blockquote>${body}</blockquote>`);
    quoteLines = [];
  };

  const flushCode = () => {
    if (!codeLines.length) {
      return;
    }
    output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (inCodeBlock) {
      if (trimmed.startsWith('```')) {
        flushCode();
        inCodeBlock = false;
        continue;
      }
      codeLines.push(line);
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      flushQuote();
      inCodeBlock = true;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      output.push(`<h${level}>${renderInlineMarkdown(text, baseUrl)}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      output.push('<hr />');
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      flushQuote();
      const marker = listMatch[1];
      const item = listMatch[2];
      const nextType = marker.endsWith('.') ? 'ol' : 'ul';
      if (listType && listType !== nextType) {
        flushList();
      }
      listType = nextType;
      listItems.push(item);
      continue;
    }

    const quoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      const quoteText = quoteMatch[1].trim();
      if (quoteText) {
        quoteLines.push(quoteText);
      }
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushQuote();
  if (inCodeBlock) {
    flushCode();
  }

  return output.join('\n');
};

const renderPlainTextToHtml = (text: string) => {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '';
  }
  const paragraphs = normalized.split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.split('\n');
      const htmlLines = lines.map((line) => escapeHtml(line)).join('<br />');
      return `<p>${htmlLines}</p>`;
    })
    .join('\n');
};

const formatUrlDisplayName = (url: URL) => {
  const path = url.pathname && url.pathname !== '/' ? url.pathname : '';
  const label = `${url.hostname}${path}`;
  if (label.length <= 80) {
    return label;
  }
  return `${label.slice(0, 77)}...`;
};

const parseUrlInput = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  const jinaPattern = /^https?:\/\/r\.jina\.ai\//i;
  let sourceUrl = normalized;
  let jinaUrl = normalized;

  if (jinaPattern.test(normalized)) {
    const stripped = normalized.replace(jinaPattern, '');
    if (/^https?:\/\//i.test(stripped)) {
      sourceUrl = stripped;
    }
  } else {
    jinaUrl = `https://r.jina.ai/${sourceUrl}`;
  }

  try {
    const parsedSource = new URL(sourceUrl);
    const parsedJina = new URL(jinaUrl);
    return {
      sourceUrl: parsedSource,
      jinaUrl: parsedJina.toString(),
      displayName: formatUrlDisplayName(parsedSource),
    };
  } catch (error) {
    return null;
  }
};

const docxBlockSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th';

const getDocxPageMetrics = () => {
  const fallbackHeight = 520;
  const fallbackPadding = 22;
  if (!docxViewer) {
    const contentHeight = Math.max(200, fallbackHeight - fallbackPadding * 2);
    return { pageHeight: fallbackHeight, pageContentHeight: contentHeight };
  }
  const style = window.getComputedStyle(docxViewer);
  const padding = Number.parseFloat(style.getPropertyValue('--docx-page-padding')) || fallbackPadding;
  const pageHeight = Math.max(320, docxViewer.clientHeight || fallbackHeight);
  const pageContentHeight = Math.max(200, pageHeight - padding * 2);
  return { pageHeight, pageContentHeight };
};

const createDocxPage = (pageNumber: number, container: HTMLElement, pages: DocxPage[]) => {
  const pageEl = document.createElement('section');
  pageEl.className = 'docx-page';
  pageEl.dataset.pageNumber = String(pageNumber);

  const contentEl = document.createElement('div');
  contentEl.className = 'docx-page-content';

  pageEl.append(contentEl);
  container.append(pageEl);

  const page = { pageNumber, element: pageEl as HTMLDivElement, content: contentEl };
  pages.push(page);
  return page;
};

const paginateDocxHtml = (html: string) => {
  if (!docxViewer) {
    return [];
  }

  docxViewer.innerHTML = '';
  const pagesContainer = document.createElement('div');
  pagesContainer.className = 'docx-pages';
  docxViewer.append(pagesContainer);

  const scratch = document.createElement('div');
  scratch.innerHTML = html;
  const nodes = Array.from(scratch.childNodes).filter((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return Boolean(node.textContent?.trim());
    }
    return true;
  });

  if (nodes.length === 0) {
    return [];
  }

  const { pageHeight, pageContentHeight } = getDocxPageMetrics();
  docxViewer.style.setProperty('--docx-page-height', `${pageHeight}px`);

  const pages: DocxPage[] = [];
  let pageNumber = 1;
  let currentPage = createDocxPage(pageNumber, pagesContainer, pages);

  for (const node of nodes) {
    currentPage.content.append(node);
    const isOverflow = currentPage.content.scrollHeight > pageContentHeight;
    if (isOverflow && currentPage.content.childNodes.length > 1) {
      currentPage.content.removeChild(node);
      pageNumber += 1;
      currentPage = createDocxPage(pageNumber, pagesContainer, pages);
      currentPage.content.append(node);
    }
  }

  return pages;
};

const buildDocxPageTextMap = (pageContent: HTMLElement): DocxPageTextMap => {
  const candidates = Array.from(pageContent.querySelectorAll<HTMLElement>(docxBlockSelector));
  const leafBlocks = candidates.filter(
    (element) => !candidates.some((other) => other !== element && element.contains(other)),
  );
  const blocks = leafBlocks.length > 0 ? leafBlocks : [pageContent];
  const mappedBlocks: DocxBlock[] = [];
  let fullText = '';
  let paragraphIndex = 0;

  for (const block of blocks) {
    const text = block.textContent ?? '';
    if (!text.trim()) {
      continue;
    }
    const charStart = fullText.length;
    fullText += text;
    const charEnd = fullText.length;
    mappedBlocks.push({ element: block, text, charStart, charEnd, paragraphIndex });
    fullText += '\n\n';
    paragraphIndex += 1;
  }

  return { fullText, blocks: mappedBlocks };
};

const segmentDocxPageText = (textMap: DocxPageTextMap, pageNumber: number): SentenceSegment[] => {
  const sentences: SentenceSegment[] = [];
  const paragraphRanges = getParagraphRanges(textMap.fullText);
  let paragraphIndex = 0;

  for (const range of paragraphRanges) {
    const paragraphText = textMap.fullText.slice(range.start, range.end);
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

const findTextNodePosition = (root: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let lastNode: Text | null = null;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const length = node.nodeValue?.length ?? 0;
    if (currentOffset + length >= offset) {
      return { node, offset: Math.max(0, Math.min(length, offset - currentOffset)) };
    }
    currentOffset += length;
    lastNode = node;
  }

  if (lastNode) {
    return { node: lastNode, offset: lastNode.nodeValue?.length ?? 0 };
  }

  return null;
};

const applyInlineHighlight = (block: HTMLElement, startOffset: number, endOffset: number, sentenceId: string) => {
  if (startOffset >= endOffset) {
    return false;
  }

  const startPosition = findTextNodePosition(block, startOffset);
  const endPosition = findTextNodePosition(block, endOffset);
  if (!startPosition || !endPosition) {
    return false;
  }

  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);
  if (range.collapsed) {
    return false;
  }

  const highlight = document.createElement('span');
  highlight.className = 'docx-highlight';
  highlight.dataset.sentenceId = sentenceId;
  highlight.append(range.extractContents());
  range.insertNode(highlight);
  range.detach();
  return true;
};

const clearDocxHighlights = (page: DocxPage) => {
  const highlights = page.content.querySelectorAll<HTMLSpanElement>('.docx-highlight');
  if (highlights.length === 0) {
    return;
  }

  highlights.forEach((highlight) => {
    const parent = highlight.parentNode;
    if (!parent) {
      return;
    }
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
  });
  page.content.normalize();
  page.element.dataset.highlightCount = '0';
};

const renderDocxPageHighlights = (
  page: DocxPage,
  textMap: DocxPageTextMap,
  highlights: SentenceSegment[],
) => {
  if (!highlights.length) {
    return 0;
  }

  const blockByParagraph = new Map<number, DocxBlock>();
  for (const block of textMap.blocks) {
    blockByParagraph.set(block.paragraphIndex, block);
  }

  let rendered = 0;
  for (const sentence of highlights) {
    const block = blockByParagraph.get(sentence.paragraphIndex);
    if (!block) {
      continue;
    }
    const startOffset = sentence.charStart - block.charStart;
    const endOffset = sentence.charEnd - block.charStart;
    if (startOffset < 0 || endOffset <= startOffset) {
      continue;
    }
    if (applyInlineHighlight(block.element, startOffset, endOffset, sentence.id)) {
      rendered += 1;
    }
  }

  const pageElement = page.element;
  if (pageElement) {
    pageElement.dataset.highlightCount = String(rendered);
  }

  return rendered;
};

const indexDocxPage = async (page: DocxPage, processId: number, sourceKind: ReadingSourceKind) => {
  const textMap = buildDocxPageTextMap(page.content);
  const sentences = segmentDocxPageText(textMap, page.pageNumber);
  let embeddings: Float32Array[] | null = null;

  if (sentences.length) {
    try {
      embeddings = await computeEmbeddingsForSentences(sentences);
    } catch (error) {
      console.debug(`Embedding failed for ${getReadingLabel(sourceKind)} page`, page.pageNumber, error);
    }
  }

  if (processId !== backgroundProcessId) {
    return null;
  }

  const highlights = selectAutoHighlights(sentences, embeddings);
  renderDocxPageHighlights(page, textMap, highlights);
  return { source: sourceKind, pageNumber: page.pageNumber, sentences, highlights, embeddings };
};

const startDocxIndexing = async (
  pages: DocxPage[],
  processId: number,
  sourceKind: ReadingSourceKind,
) => {
  for (const page of pages) {
    if (processId !== backgroundProcessId) {
      return;
    }

    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      `Indexing page ${page.pageNumber} of ${backgroundTotalPages}...`,
    );

    try {
      const entry = await indexDocxPage(page, processId, sourceKind);
      if (!entry) {
        return;
      }
      indexedPages.set(entry.pageNumber, entry);
      renderStudyStrip();
    } catch (error) {
      console.error(`Failed to index ${getReadingLabel(sourceKind)} page`, page.pageNumber, error);
    }

    backgroundProcessedPages = Math.min(backgroundTotalPages, backgroundProcessedPages + 1);
    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      `Indexed ${backgroundProcessedPages} of ${backgroundTotalPages} pages.`,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
};

const updateDocxPageIndicator = () => {
  if (!docxViewer || docxPages.length === 0) {
    return;
  }
  const midpoint = docxViewer.scrollTop + docxViewer.clientHeight * 0.4;
  let current = docxPages[0].pageNumber;

  for (const page of docxPages) {
    const top = page.element.offsetTop;
    const bottom = top + page.element.offsetHeight;
    if (midpoint >= top && midpoint <= bottom) {
      current = page.pageNumber;
      break;
    }
  }

  setPageIndicator(current, docxPages.length);
};

const renderDocxDocument = async (html: string, sourceKind: ReadingSourceKind) => {
  if (!docxViewer) {
    return;
  }

  const sourceLabel = getReadingLabel(sourceKind);
  indexedPages.clear();
  pinnedHighlightIds.clear();
  renderStudyStrip();
  docxPages = paginateDocxHtml(html);

  if (docxPages.length === 0) {
    docxViewer.innerHTML = `<p class="muted">No readable text found in this ${sourceLabel}.</p>`;
    setPageIndicatorLabel(`${sourceLabel} preview`);
    setStatus(`${sourceLabel} loaded, but no readable text found.`);
    setProgress(0, 0, 'No readable text found.');
    return;
  }

  const processId = backgroundProcessId;
  backgroundTotalPages = docxPages.length;
  backgroundProcessedPages = 0;
  setProgress(0, backgroundTotalPages, `Preparing page 1 of ${backgroundTotalPages}...`);
  setPageIndicator(1, backgroundTotalPages);
  docxViewer.scrollTop = 0;

  const firstPage = docxPages[0];
  setStatus(`Highlighting ${sourceLabel} page 1...`);
  const firstEntry = await indexDocxPage(firstPage, processId, sourceKind);
  if (!firstEntry) {
    return;
  }
  indexedPages.set(firstEntry.pageNumber, firstEntry);
  setExportEnabled(true);
  renderStudyStrip();
  backgroundProcessedPages = 1;

  const statusPrefix = `${sourceLabel} page 1 highlighted with ${firstEntry.highlights.length} sentences.`;
  setStatus(statusPrefix);
  const progressMessage =
    backgroundTotalPages > 1
      ? 'Page 1 ready. Indexing remaining pages...'
      : `Single-page ${sourceLabel} ready.`;
  setProgress(backgroundProcessedPages, backgroundTotalPages, progressMessage);
  updateDocxPageIndicator();

  if (backgroundTotalPages > 1) {
    void startDocxIndexing(docxPages.slice(1), processId, sourceKind);
  }
};

const loadDocx = async (file: File) => {
  if (!isDocxFile(file)) {
    setStatus('That file is not a DOCX. Please choose a .docx file.');
    return;
  }

  resetViewer();
  setFileName(file.name);
  currentFileName = file.name;
  setStatus('Loading DOCX...');
  setProgress(0, 0, 'Converting DOCX...');

  try {
    const buffer = await file.arrayBuffer();
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    if (result.messages?.length) {
      console.debug('Mammoth conversion messages', result.messages);
    }
    const sanitizedHtml = sanitizeDocxHtml(result.value ?? '');
    docxHtml = sanitizedHtml;
    setViewerMode('docx');
    setStatus('Paginating DOCX into pages...');
    setProgress(0, 0, 'Preparing DOCX pages...');
    await renderDocxDocument(docxHtml ?? '', 'docx');
  } catch (error) {
    console.error(error);
    setStatus('Unable to render this DOCX. Try another file.');
    setProgress(0, 0, 'DOCX rendering failed.');
    if (viewerPlaceholder) {
      viewerPlaceholder.textContent = 'DOCX rendering failed. Upload another file.';
    }
  }
};

const loadUrl = async (input: string) => {
  const parsed = parseUrlInput(input);
  if (!parsed) {
    setStatus('Enter a valid URL to fetch.');
    return;
  }

  resetViewer();
  const processId = backgroundProcessId;
  setFileName(`URL: ${parsed.displayName}`);
  currentFileName = parsed.displayName;
  setStatus('Fetching URL...');
  setProgress(0, 0, 'Fetching URL content via r.jina.ai...');
  if (urlFetchButton) {
    urlFetchButton.disabled = true;
  }
  if (urlInput) {
    urlInput.disabled = true;
  }

  try {
    const response = await fetch(parsed.jinaUrl);
    if (!response.ok) {
      throw new Error(`URL fetch failed with status ${response.status}`);
    }
    const text = await response.text();
    if (processId !== backgroundProcessId) {
      return;
    }
    const renderedHtml = renderMarkdownToHtml(text, parsed.sourceUrl);
    const sanitizedHtml = sanitizeDocxHtml(renderedHtml);
    docxHtml = sanitizedHtml;
    setViewerMode('url');
    setStatus('Paginating URL content into pages...');
    setProgress(0, 0, 'Preparing URL pages...');
    await renderDocxDocument(docxHtml ?? '', 'url');
  } catch (error) {
    console.error(error);
    setStatus('Unable to fetch this URL. Check the link and try again.');
    setProgress(0, 0, 'URL fetch failed.');
    if (viewerPlaceholder) {
      viewerPlaceholder.textContent = 'URL fetch failed. Try another link.';
    }
  } finally {
    if (urlFetchButton) {
      urlFetchButton.disabled = false;
    }
    if (urlInput) {
      urlInput.disabled = false;
    }
  }
};

const loadText = async (input: string) => {
  const normalized = input.replace(/\r\n/g, '\n');
  const trimmed = normalized.trim();
  if (!trimmed) {
    setStatus('Paste some text to render.');
    return;
  }

  resetViewer();
  setFileName('Pasted text');
  currentFileName = 'Pasted text';
  setStatus('Preparing pasted text...');
  setProgress(0, 0, 'Preparing pasted text...');

  const renderedHtml = renderPlainTextToHtml(normalized);
  const sanitizedHtml = sanitizeDocxHtml(renderedHtml);
  docxHtml = sanitizedHtml;
  setViewerMode('text');
  setStatus('Paginating pasted text into pages...');
  setProgress(0, 0, 'Preparing text pages...');
  await renderDocxDocument(docxHtml ?? '', 'text');
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
  const settings = highlightIntensitySettings[currentHighlightIntensity];
  const target = Math.min(settings.max, Math.ceil(settings.ratio * sentenceCount));
  if (sentenceCount <= 1) {
    return sentenceCount;
  }
  const minimum = Math.min(sentenceCount, settings.min);
  return Math.min(sentenceCount, Math.max(minimum, target));
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

const getStudyStripExportPayload = (): StudyStripExportPayload | null => {
  const sections = buildStudyStripSections();
  if (!sections.length) {
    return null;
  }

  const pinnedSections = sections
    .map((section) => ({
      pageNumber: section.pageNumber,
      highlights: section.highlights.filter((sentence) => pinnedHighlightIds.has(sentence.id)),
    }))
    .filter((section) => section.highlights.length > 0);

  if (pinnedSections.length > 0) {
    return { mode: 'pinned', sections: pinnedSections };
  }

  return { mode: 'all', sections };
};

const formatStudyStripMarkdown = (payload: StudyStripExportPayload) => {
  const titleSuffix = currentFileName?.trim() ? ` (${currentFileName.trim()})` : '';
  const lines: string[] = [`# Study Strip${titleSuffix}`];

  for (const section of payload.sections) {
    lines.push('', `## Page ${section.pageNumber}`);
    for (const sentence of section.highlights) {
      const text = sentence.text.trim();
      if (!text) {
        continue;
      }
      lines.push(`- ${text}`);
    }
  }

  return `${lines.join('\n').trim()}\n`;
};

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document.execCommand !== 'function') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const success = document.execCommand('copy');
  textarea.remove();
  return success;
};

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

const setStudyStripExportState = (pinnedCount: number, totalCount: number) => {
  const hasHighlights = totalCount > 0;
  if (studyStripCopyButton) {
    studyStripCopyButton.disabled = !hasHighlights;
  }
  if (studyStripDownloadButton) {
    studyStripDownloadButton.disabled = !hasHighlights;
  }
  if (!studyStripExportNote) {
    return;
  }
  if (!hasHighlights) {
    studyStripExportNote.textContent = 'No highlights to export yet.';
    return;
  }
  studyStripExportNote.textContent =
    pinnedCount > 0 ? 'Exports pinned lines only.' : 'Exports all highlighted lines.';
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
  setStudyStripExportState(totalPinned, totalHighlights);

  if (!sections.length) {
    if (currentSourceKind === 'docx') {
      studyStripEmpty.textContent = 'DOCX highlights will appear here once available.';
    } else if (currentSourceKind === 'url') {
      studyStripEmpty.textContent = 'URL highlights will appear here once available.';
    } else if (currentSourceKind === 'text') {
      studyStripEmpty.textContent = 'Text highlights will appear here once available.';
    } else {
      studyStripEmpty.textContent =
        indexedPages.size === 0
          ? 'Upload a PDF, DOCX, URL, or text to populate the study strip.'
          : 'No highlights available yet.';
    }
    studyStripEmpty.hidden = false;
    studyStripList.hidden = true;
    return;
  }

  studyStripEmpty.hidden = true;
  studyStripList.hidden = false;
  studyStripList.append(fragment);
};

const updateHighlightModeControls = () => {
  highlightModeButtons.forEach((button) => {
    const mode = button.dataset.highlightMode as HighlightMode | undefined;
    if (!mode) {
      return;
    }
    button.setAttribute('aria-pressed', mode === currentHighlightMode ? 'true' : 'false');
  });
  if (highlightModeNote) {
    highlightModeNote.textContent = 'Auto mode selects key sentences. Question mode is coming soon.';
  }
};

const setHighlightMode = (mode: HighlightMode) => {
  if (currentHighlightMode === mode) {
    return;
  }
  currentHighlightMode = mode;
  updateHighlightModeControls();
};

const updateHighlightIntensityControls = () => {
  highlightIntensityButtons.forEach((button) => {
    const intensity = button.dataset.highlightIntensity as HighlightIntensity | undefined;
    if (!intensity) {
      return;
    }
    button.setAttribute('aria-pressed', intensity === currentHighlightIntensity ? 'true' : 'false');
  });
  if (highlightIntensityNote) {
    highlightIntensityNote.textContent = highlightIntensitySettings[currentHighlightIntensity].note;
  }
};

const applyHighlightIntensity = () => {
  if (indexedPages.size === 0) {
    return;
  }

  const shouldUpdateDocx =
    currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text';
  const docxPagesByNumber = shouldUpdateDocx
    ? new Map(docxPages.map((page) => [page.pageNumber, page]))
    : null;

  for (const entry of indexedPages.values()) {
    const embeddings = entry.embeddings ?? null;
    const highlights = selectAutoHighlights(entry.sentences, embeddings);
    entry.highlights = highlights;

    if (entry.source === 'pdf' && currentPage?.pageNumber === entry.pageNumber) {
      currentPageHighlightSentences = highlights;
    }

    if (docxPagesByNumber && entry.source !== 'pdf') {
      const page = docxPagesByNumber.get(entry.pageNumber);
      if (!page) {
        continue;
      }
      clearDocxHighlights(page);
      const textMap = buildDocxPageTextMap(page.content);
      renderDocxPageHighlights(page, textMap, highlights);
    }
  }

  if (currentSourceKind === 'pdf') {
    renderHighlights();
  }
  renderStudyStrip();
};

const setHighlightIntensity = (intensity: HighlightIntensity) => {
  if (currentHighlightIntensity === intensity) {
    return;
  }
  currentHighlightIntensity = intensity;
  updateHighlightIntensityControls();
  applyHighlightIntensity();
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

const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to capture export image.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });

const exportReadingViewPdf = async () => {
  const sourceKind = currentSourceKind;
  if (sourceKind !== 'docx' && sourceKind !== 'url' && sourceKind !== 'text') {
    setStatus('Upload a DOCX, URL, or text first to export highlights.');
    return;
  }

  if (!docxViewer || docxPages.length === 0) {
    setStatus('No reading view available to export yet.');
    return;
  }

  if (indexedPages.size === 0) {
    setStatus('Highlights are not ready yet.');
    return;
  }

  setExportEnabled(false);
  const sourceLabel = getReadingLabel(sourceKind);
  const totalPages = docxPages.length;
  const processedPages = indexedPages.size;
  if (processedPages < totalPages) {
    setStatus(`Exporting highlights for ${processedPages} of ${totalPages} pages...`);
  } else {
    setStatus(`Exporting highlighted ${sourceLabel} PDF...`);
  }

  try {
    const [{ PDFDocument }, { default: html2canvas }] = await Promise.all([
      import('pdf-lib'),
      import('html2canvas'),
    ]);
    const pdfDocument = await PDFDocument.create();
    const scale = Math.min(2, window.devicePixelRatio || 1);

    for (const page of docxPages) {
      setStatus(`Rendering ${sourceLabel} page ${page.pageNumber} of ${docxPages.length} for export...`);
      const canvas = await (html2canvas as Html2CanvasRenderer)(page.element, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
      });
      const blob = await canvasToPngBlob(canvas);
      const imageBytes = new Uint8Array(await blob.arrayBuffer());
      const png = await pdfDocument.embedPng(imageBytes);
      const pdfPage = pdfDocument.addPage([png.width, png.height]);
      pdfPage.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
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

const exportHighlightedPdf = async () => {
  if (currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text') {
    await exportReadingViewPdf();
    return;
  }

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
      if (entry.source !== 'pdf') {
        continue;
      }
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
  return { source: 'pdf', pageNumber, textMap, sentences, highlights, embeddings };
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
    setViewerMode('pdf');
    setStatus(`Rendering page 1 of ${pdfDoc.numPages}...`);
    await renderPage(currentPage);
    currentPageTextMap = await extractPageTextMap(currentPage);
    currentPageSentences = segmentPageText(currentPageTextMap, currentPage.pageNumber);
    updateAutoHighlights(currentPageSentences, null);
    indexedPages.set(currentPage.pageNumber, {
      source: 'pdf',
      pageNumber: currentPage.pageNumber,
      textMap: currentPageTextMap,
      sentences: currentPageSentences,
      highlights: currentPageHighlightSentences,
      embeddings: null,
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

const bindDropzone = (zone: HTMLLabelElement | null, onFile: (file: File) => void) => {
  if (!zone) {
    return;
  }

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('is-dragover');
  });

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragover');
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    onFile(file);
  });
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

docxInput?.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  void loadDocx(file);
  target.value = '';
});

urlFetchButton?.addEventListener('click', () => {
  if (!urlInput) {
    return;
  }
  void loadUrl(urlInput.value);
});

urlInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }
  event.preventDefault();
  void loadUrl(urlInput.value);
});

textRenderButton?.addEventListener('click', () => {
  if (!textInput) {
    return;
  }
  void loadText(textInput.value);
});

textInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }
  if (!event.metaKey && !event.ctrlKey) {
    return;
  }
  event.preventDefault();
  void loadText(textInput.value);
});

bindDropzone(pdfDropzone, (file) => {
  void loadPdf(file);
});

bindDropzone(docxDropzone, (file) => {
  void loadDocx(file);
});

highlightModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    const mode = button.dataset.highlightMode as HighlightMode | undefined;
    if (!mode) {
      return;
    }
    setHighlightMode(mode);
  });
});

highlightIntensityButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const intensity = button.dataset.highlightIntensity as HighlightIntensity | undefined;
    if (!intensity) {
      return;
    }
    setHighlightIntensity(intensity);
  });
});

downloadButton?.addEventListener('click', () => {
  void exportHighlightedPdf();
});

studyStripCopyButton?.addEventListener('click', async () => {
  const payload = getStudyStripExportPayload();
  if (!payload) {
    setStatus('No highlights available to export.');
    return;
  }
  const markdown = formatStudyStripMarkdown(payload);
  if (!markdown.trim()) {
    setStatus('No highlights available to export.');
    return;
  }
  try {
    const copied = await copyTextToClipboard(markdown);
    if (!copied) {
      setStatus('Unable to copy highlights to clipboard.');
      return;
    }
    const label = payload.mode === 'pinned' ? 'Pinned highlights' : 'Highlights';
    setStatus(`${label} copied to clipboard.`);
  } catch (error) {
    console.error(error);
    setStatus('Unable to copy highlights to clipboard.');
  }
});

studyStripDownloadButton?.addEventListener('click', () => {
  const payload = getStudyStripExportPayload();
  if (!payload) {
    setStatus('No highlights available to export.');
    return;
  }
  const markdown = formatStudyStripMarkdown(payload);
  if (!markdown.trim()) {
    setStatus('No highlights available to export.');
    return;
  }
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'highlights.md';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const label = payload.mode === 'pinned' ? 'Pinned highlights' : 'Highlights';
  setStatus(`${label} downloaded as highlights.md.`);
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

let docxScrollFrame = 0;
docxViewer?.addEventListener('scroll', () => {
  if (currentSourceKind !== 'docx' && currentSourceKind !== 'url' && currentSourceKind !== 'text') {
    return;
  }
  if (docxScrollFrame) {
    window.cancelAnimationFrame(docxScrollFrame);
  }
  docxScrollFrame = window.requestAnimationFrame(() => {
    docxScrollFrame = 0;
    updateDocxPageIndicator();
  });
});

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (currentSourceKind === 'pdf' && currentPage) {
      void renderPage(currentPage).then(() => {
        renderHighlights();
      });
      return;
    }
    if ((currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text') && docxHtml) {
      backgroundProcessId += 1;
      void renderDocxDocument(docxHtml, currentSourceKind);
    }
  }, 150);
});

updateHighlightModeControls();
updateHighlightIntensityControls();
renderStudyStrip();
