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
          <label class="dropzone" id="pdf-dropzone" for="pdf-input" tabindex="0" role="button">
            <input id="pdf-input" type="file" accept="application/pdf" />
            <span class="dropzone-title">Choose a PDF</span>
            <span class="dropzone-subtitle">or drag & drop here</span>
          </label>
          <label class="dropzone" id="docx-dropzone" for="docx-input" tabindex="0" role="button">
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
        <div class="privacy-panel" aria-live="polite">
          <p class="privacy-title">Privacy &amp; security</p>
          <ul class="privacy-list">
            <li>PDF, DOCX, and pasted text stay in your browser for highlighting.</li>
            <li>URL fetching uses r.jina.ai (third-party) to extract readable text.</li>
            <li>Rendered content is sanitized; scripts, embeds, and unsafe links are removed.</li>
            <li>External links open in a new tab.</li>
          </ul>
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
              >
                Question
              </button>
            </div>
            <p id="mode-note" class="muted control-note">Auto mode selects key sentences. Question adds answers on top.</p>
          </div>
          <div class="control-group question-group" id="question-group" hidden>
            <label class="control-label" for="question-input">Question</label>
            <div class="question-row">
              <input
                id="question-input"
                class="question-input"
                type="text"
                placeholder="What should I focus on?"
                autocomplete="off"
                aria-describedby="question-note"
              />
              <button id="question-apply" class="secondary-button" type="button">Highlight</button>
            </div>
            <p id="question-note" class="muted control-note">Ask a question to layer answers on top of auto highlights.</p>
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
          <div class="control-group">
            <p class="control-label">Viewer</p>
            <div class="segmented-control" role="group" aria-label="Viewer mode">
              <button
                class="segment-button"
                type="button"
                data-view-mode="preview"
                aria-pressed="true"
              >
                Preview
              </button>
              <button
                class="segment-button"
                type="button"
                data-view-mode="list"
                aria-pressed="false"
              >
                List
              </button>
            </div>
            <p id="contrast-note" class="muted control-note">Contrast check pending.</p>
          </div>
        </div>
        <div
          id="viewer-stage"
          class="viewer-stage"
          tabindex="0"
          role="region"
          aria-label="Document viewer"
          aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Home End"
        >
          <div id="viewer-placeholder" class="viewer-placeholder">
            Document preview will appear here after upload.
          </div>
          <div id="pdf-stack" class="pdf-stack" aria-hidden="true">
            <canvas id="pdf-canvas" class="pdf-canvas" aria-label="PDF page preview"></canvas>
            <div id="highlight-layer" class="highlight-layer"></div>
          </div>
          <div id="docx-viewer" class="docx-viewer" aria-live="polite"></div>
          <div
            id="highlight-list-view"
            class="highlight-list"
            role="region"
            aria-label="Highlights list"
            aria-live="polite"
            hidden
          ></div>
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
          <p id="scan-warning" class="warning-note" hidden></p>
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
const scanWarning = document.querySelector<HTMLParagraphElement>('#scan-warning');
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
const questionGroup = document.querySelector<HTMLDivElement>('#question-group');
const questionInput = document.querySelector<HTMLInputElement>('#question-input');
const questionButton = document.querySelector<HTMLButtonElement>('#question-apply');
const questionNote = document.querySelector<HTMLParagraphElement>('#question-note');
const highlightIntensityButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-highlight-intensity]'),
);
const highlightIntensityNote = document.querySelector<HTMLParagraphElement>('#intensity-note');
const viewerModeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-view-mode]'),
);
const contrastNote = document.querySelector<HTMLParagraphElement>('#contrast-note');
const highlightListView = document.querySelector<HTMLDivElement>('#highlight-list-view');

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
type ViewerMode = 'preview' | 'list';

type IndexedPage =
  | {
      source: 'pdf';
      pageNumber: number;
      textMap: PageTextMap;
      sentences: SentenceSegment[];
      highlights: SentenceSegment[];
      questionHighlights?: SentenceSegment[];
      embeddings: Float32Array[] | null;
    }
  | {
      source: ReadingSourceKind;
      pageNumber: number;
      sentences: SentenceSegment[];
      highlights: SentenceSegment[];
      questionHighlights?: SentenceSegment[];
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

type EmbeddingWorkerRequest = {
  type: 'embed';
  id: number;
  inputs: string[];
  device: EmbeddingDevice;
  batchSize: number;
};

type EmbeddingWorkerResponse = {
  type: 'embed-result';
  id: number;
  device: EmbeddingDevice;
  count: number;
  dim: number;
  buffer: ArrayBuffer;
  error?: string;
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

const performanceLimits = {
  maxAutoPages: 200,
  maxSentences: 20000,
  embeddingBatch: {
    webgpu: { min: 12, max: 48 },
    wasm: { min: 4, max: 16 },
  },
  workerSentenceThreshold: 12,
  docCentroidSamples: {
    perPage: 6,
    max: 120,
  },
};

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
let currentViewMode: ViewerMode = 'preview';
const highlightMmrLambda = 0.35;
let currentQuestionQuery: string | null = null;
let currentQuestionEmbedding: Float32Array | null = null;
let questionRequestId = 0;
let embeddingPipelinePromise: Promise<EmbeddingPipeline> | null = null;
let embeddingBackend: EmbeddingDevice | null = null;
let embeddingWorker: Worker | null = null;
let embeddingWorkerFailed = false;
let embeddingWorkerRequestId = 0;
const embeddingWorkerRequests = new Map<
  number,
  {
    resolve: (result: { embeddings: Float32Array[]; device: EmbeddingDevice } | null) => void;
    reject: (error: Error) => void;
  }
>();
let embeddingRequestId = 0;
let currentPageEmbeddings: Float32Array[] | null = null;
let docEmbeddingSamples: Float32Array[] = [];
let docEmbeddingCentroid: Float32Array | null = null;
const docSampledPages = new Set<number>();
let currentPageHighlightSentences: SentenceSegment[] = [];
let docxHtml: string | null = null;
let docxPages: DocxPage[] = [];
let currentDocxPageNumber = 1;
const indexedPages = new Map<number, IndexedPage>();
let backgroundProcessId = 0;
let backgroundProcessedPages = 0;
let backgroundTotalPages = 0;
let pdfNavigationId = 0;
let autoSentenceCount = 0;
let autoSentenceCapReached = false;
let pdfHasExtractedText = false;

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

const yieldToUi = () =>
  new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const idle = (
      window as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }
    ).requestIdleCallback;
    if (typeof idle === 'function') {
      idle(() => resolve(), { timeout: 120 });
      return;
    }
    window.setTimeout(resolve, 0);
  });

const appendNote = (message: string, note: string | null) => (note ? `${message} ${note}` : message);

const getAutoPageLimit = (totalPages: number) => {
  const cappedTotalPages = Math.min(totalPages, performanceLimits.maxAutoPages);
  return { cappedTotalPages, isCapped: totalPages > cappedTotalPages };
};

const getAutoPageNote = (totalPages: number, cappedTotalPages: number) =>
  totalPages > cappedTotalPages
    ? `Auto-highlighting first ${cappedTotalPages} of ${totalPages} pages.`
    : null;

const getSentenceCapMessage = () =>
  `Auto-highlighting paused after ${performanceLimits.maxSentences} sentences to keep things fast.`;

const clampSentencesForAutoIndexing = (sentences: SentenceSegment[]) => {
  const remaining = performanceLimits.maxSentences - autoSentenceCount;
  if (remaining <= 0) {
    autoSentenceCapReached = true;
    return { sentences: [] as SentenceSegment[], capped: true };
  }
  if (sentences.length > remaining) {
    autoSentenceCapReached = true;
    return { sentences: sentences.slice(0, remaining), capped: true };
  }
  return { sentences, capped: false };
};

const registerAutoSentenceCount = (count: number) => {
  autoSentenceCount = Math.min(performanceLimits.maxSentences, autoSentenceCount + count);
};

const resetDocCentroidSamples = () => {
  docEmbeddingSamples = [];
  docEmbeddingCentroid = null;
  docSampledPages.clear();
};

const getEmbeddingBatchSize = (device: EmbeddingDevice, total: number) => {
  const config = performanceLimits.embeddingBatch[device];
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4;
  const scaled = Math.round(cores * (device === 'webgpu' ? 6 : 2));
  const batchSize = Math.min(config.max, Math.max(config.min, scaled));
  return Math.max(1, Math.min(total, batchSize));
};

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

const inflateWorkerEmbeddings = (buffer: ArrayBuffer, count: number, dim: number) => {
  if (!buffer || count <= 0 || dim <= 0) {
    return null;
  }
  const data = new Float32Array(buffer);
  if (data.length < count * dim) {
    return null;
  }
  const embeddings: Float32Array[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * dim;
    embeddings.push(data.subarray(start, start + dim));
  }
  return embeddings;
};

const handleEmbeddingWorkerMessage = (event: MessageEvent<EmbeddingWorkerResponse>) => {
  const message = event.data;
  if (!message || message.type !== 'embed-result') {
    return;
  }
  const pending = embeddingWorkerRequests.get(message.id);
  if (!pending) {
    return;
  }
  embeddingWorkerRequests.delete(message.id);
  if (message.error) {
    pending.reject(new Error(message.error));
    return;
  }
  const embeddings = inflateWorkerEmbeddings(message.buffer, message.count, message.dim);
  if (!embeddings) {
    pending.reject(new Error('Embedding worker returned invalid data.'));
    return;
  }
  pending.resolve({ embeddings, device: message.device });
};

const failEmbeddingWorkerRequests = (error: Error) => {
  embeddingWorkerRequests.forEach((pending) => pending.reject(error));
  embeddingWorkerRequests.clear();
};

const getEmbeddingWorker = () => {
  if (embeddingWorkerFailed || typeof Worker === 'undefined') {
    return null;
  }
  if (embeddingWorker) {
    return embeddingWorker;
  }
  try {
    embeddingWorker = new Worker(new URL('./embedding.worker.ts', import.meta.url), { type: 'module' });
    embeddingWorker.addEventListener('message', handleEmbeddingWorkerMessage);
    embeddingWorker.addEventListener('error', (event) => {
      embeddingWorkerFailed = true;
      const error =
        event instanceof ErrorEvent && event.error instanceof Error
          ? event.error
          : new Error('Embedding worker failed.');
      failEmbeddingWorkerRequests(error);
    });
  } catch (error) {
    embeddingWorkerFailed = true;
    return null;
  }
  return embeddingWorker;
};

const requestEmbeddingsFromWorker = async (
  inputs: string[],
  device: EmbeddingDevice,
  batchSize: number,
) => {
  const worker = getEmbeddingWorker();
  if (!worker) {
    return null;
  }
  return new Promise<{ embeddings: Float32Array[]; device: EmbeddingDevice } | null>(
    (resolve, reject) => {
      const id = (embeddingWorkerRequestId += 1);
      embeddingWorkerRequests.set(id, { resolve, reject });
      const payload: EmbeddingWorkerRequest = {
        type: 'embed',
        id,
        inputs,
        device,
        batchSize,
      };
      worker.postMessage(payload);
    },
  );
};

const shouldUseEmbeddingWorker = (allowWorker: boolean, sentenceCount: number) => {
  if (!allowWorker) {
    return false;
  }
  if (sentenceCount < performanceLimits.workerSentenceThreshold) {
    return false;
  }
  return Boolean(getEmbeddingWorker());
};

const prepareEmbeddingInputs = (sentences: SentenceSegment[], prefix: string = 'passage') =>
  sentences.map((sentence) => `${prefix}: ${sentence.text}`);

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

const computeEmbeddingsForInputs = async (
  inputs: string[],
  options: { allowWorker?: boolean } = {},
) => {
  if (!inputs.length) {
    return null;
  }

  const preferredDevice = getEmbeddingDevice();
  const batchSize = getEmbeddingBatchSize(preferredDevice, inputs.length);
  const workerDevice = preferredDevice === 'webgpu' ? 'wasm' : preferredDevice;
  const workerBatchSize = getEmbeddingBatchSize(workerDevice, inputs.length);

  if (shouldUseEmbeddingWorker(Boolean(options.allowWorker), inputs.length)) {
    try {
      const workerResult = await requestEmbeddingsFromWorker(inputs, workerDevice, workerBatchSize);
      if (workerResult?.embeddings) {
        embeddingBackend = workerResult.device;
        return workerResult.embeddings;
      }
    } catch (error) {
      console.debug('Embedding worker failed, falling back to main thread.', error);
    }
  }

  const extractor = await getEmbeddingPipeline();
  const pooledEmbeddings: Float32Array[] = [];

  for (let offset = 0; offset < inputs.length; offset += batchSize) {
    const batchInputs = inputs.slice(offset, offset + batchSize);
    const tokenEmbeddings = await extractor(batchInputs, { pooling: 'none' });
    const tokenBatch = extractTokenEmbeddings(tokenEmbeddings);
    if (!tokenBatch) {
      return null;
    }
    const attentionMask = await getAttentionMask(
      extractor,
      batchInputs,
      tokenBatch.batchSize,
      tokenBatch.sequenceLength,
    );
    pooledEmbeddings.push(...poolTokenEmbeddings(tokenBatch, attentionMask));
    await yieldToUi();
  }

  return pooledEmbeddings;
};

const computeEmbeddingsForSentences = async (
  sentences: SentenceSegment[],
  options: { allowWorker?: boolean; inputPrefix?: string } = {},
) => {
  if (!sentences.length) {
    return null;
  }

  const inputs = prepareEmbeddingInputs(sentences, options.inputPrefix ?? 'passage');
  return computeEmbeddingsForInputs(inputs, options);
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

const runPageEmbeddings = async (
  pageNumber: number,
  sentences: SentenceSegment[],
  statusPrefix: string,
) => {
  if (!sentences.length) {
    return;
  }

  const requestId = ++embeddingRequestId;
  const preferredDevice = getEmbeddingDevice();
  const isCurrentPage = currentPage?.pageNumber === pageNumber;
  if (isCurrentPage) {
    setStatus(`${statusPrefix} Loading embeddings (${formatEmbeddingDeviceLabel(preferredDevice)})...`);
  }

  try {
    const pooledEmbeddings = await computeEmbeddingsForSentences(sentences, { allowWorker: false });
    if (requestId !== embeddingRequestId) {
      return;
    }
    if (!pooledEmbeddings) {
      if (isCurrentPage) {
        setStatus(`${statusPrefix} Embeddings loaded but could not be parsed.`);
      }
      return;
    }

    updateDocEmbeddingCentroid(pageNumber, pooledEmbeddings);
    const autoHighlights = selectAutoHighlights(sentences, pooledEmbeddings);
    const questionHighlights =
      currentQuestionEmbedding && currentQuestionQuery
        ? selectQuestionHighlights(sentences, pooledEmbeddings, currentQuestionEmbedding)
        : [];
    const existing = indexedPages.get(pageNumber);
    if (existing && existing.source === 'pdf') {
      indexedPages.set(pageNumber, {
        ...existing,
        highlights: autoHighlights,
        questionHighlights,
        embeddings: pooledEmbeddings,
      });
    } else if (isCurrentPage && currentPageTextMap) {
      indexedPages.set(pageNumber, {
        source: 'pdf',
        pageNumber,
        textMap: currentPageTextMap,
        sentences,
        highlights: autoHighlights,
        questionHighlights,
        embeddings: pooledEmbeddings,
      });
    }

    if (isCurrentPage) {
      currentPageEmbeddings = pooledEmbeddings;
      currentPageHighlightSentences = autoHighlights;
      renderHighlights();
      if (currentViewMode === 'list') {
        renderHighlightListView();
      }
      const activeDevice = embeddingBackend ?? preferredDevice;
      const showQuestionHighlights =
        currentHighlightMode === 'question' && Boolean(currentQuestionEmbedding && currentQuestionQuery);
      const questionNote =
        showQuestionHighlights && questionHighlights.length > 0
          ? ` Added ${questionHighlights.length} question overlays.`
          : '';
      setStatus(
        `${statusPrefix} Auto-highlighted ${autoHighlights.length} sentences with embeddings (${formatEmbeddingDeviceLabel(activeDevice)}).${questionNote}`,
      );
    }
    if (pooledEmbeddings.length > 1) {
      console.debug(
        'Embedding sample similarity',
        cosineSimilarity(pooledEmbeddings[0], pooledEmbeddings[1]).toFixed(4),
      );
    }
    renderStudyStrip();
  } catch (error) {
    if (requestId !== embeddingRequestId) {
      return;
    }
    console.error(error);
    if (isCurrentPage) {
      setStatus(`${statusPrefix} Embeddings failed to load.`);
    }
  }
};

const setStatus = (message: string) => {
  if (fileStatus) {
    fileStatus.textContent = message;
  }
};

const scannedPdfWarning =
  'This looks like a scanned PDF (image-only). OCR is not included in MVP.';

const setScanWarning = (message: string | null) => {
  if (!scanWarning) {
    return;
  }
  if (!message) {
    scanWarning.textContent = '';
    scanWarning.hidden = true;
    return;
  }
  scanWarning.textContent = message;
  scanWarning.hidden = false;
};

const updatePdfScanWarning = (textMap: PageTextMap) => {
  if (currentSourceKind !== 'pdf') {
    return;
  }
  const hasText = textMap.fullText.trim().length > 0;
  if (hasText) {
    pdfHasExtractedText = true;
    setScanWarning(null);
    return;
  }
  if (!pdfHasExtractedText) {
    setScanWarning(scannedPdfWarning);
  }
};

const notifySentenceCap = () => {
  const message = getSentenceCapMessage();
  setStatus(message);
  setProgress(backgroundProcessedPages, backgroundTotalPages, message);
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

const updateViewerModeVisibility = () => {
  if (!viewerStage) {
    return;
  }
  const isList = currentViewMode === 'list';
  const isPdf = currentSourceKind === 'pdf';
  const isDocx = currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text';
  viewerStage.classList.toggle('is-list', isList);
  if (pdfStack) {
    pdfStack.setAttribute('aria-hidden', isList || !isPdf ? 'true' : 'false');
  }
  if (docxViewer) {
    docxViewer.setAttribute('aria-hidden', isList || !isDocx ? 'true' : 'false');
  }
  if (highlightListView) {
    highlightListView.hidden = !isList;
  }
};

const setViewerMode = (mode: DocumentSourceKind) => {
  currentSourceKind = mode;
  if (!viewerStage) {
    return;
  }
  viewerStage.classList.toggle('is-ready', mode !== null);
  viewerStage.classList.toggle('is-docx', mode === 'docx' || mode === 'url' || mode === 'text');
  updateViewerModeVisibility();
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
  questionRequestId += 1;
  currentQuestionQuery = null;
  currentQuestionEmbedding = null;
  if (questionInput) {
    questionInput.value = '';
  }
  if (questionButton) {
    questionButton.disabled = false;
  }
  currentViewport = null;
  pdfBytes = null;
  currentFileName = null;
  docxHtml = null;
  docxPages = [];
  currentDocxPageNumber = 1;
  embeddingRequestId += 1;
  backgroundProcessId += 1;
  autoSentenceCount = 0;
  autoSentenceCapReached = false;
  resetDocCentroidSamples();
  pdfHasExtractedText = false;
  indexedPages.clear();
  resetProgress();
  setExportEnabled(false);
  setViewerMode(null);
  setScanWarning(null);
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
  updateHighlightModeControls();
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const parseColor = (value: string): RgbColor | null => {
  const input = value.trim().toLowerCase();
  if (!input) {
    return null;
  }
  if (input.startsWith('#')) {
    const hex = input.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    }
    return null;
  }

  const rgbMatch = input.match(/rgba?\((.+)\)/);
  if (!rgbMatch) {
    return null;
  }
  const rawParts = rgbMatch[1].replace(/\//g, ',');
  const parts = rawParts.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  const parseChannel = (part: string) => {
    if (part.endsWith('%')) {
      return (Number.parseFloat(part) / 100) * 255;
    }
    return Number.parseFloat(part);
  };
  const r = parseChannel(parts[0]);
  const g = parseChannel(parts[1]);
  const b = parseChannel(parts[2]);
  const alpha = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
  if (![r, g, b, alpha].every((val) => Number.isFinite(val))) {
    return null;
  }
  return {
    r: Math.min(255, Math.max(0, r)),
    g: Math.min(255, Math.max(0, g)),
    b: Math.min(255, Math.max(0, b)),
    a: Math.min(1, Math.max(0, alpha)),
  };
};

const blendOnBackground = (foreground: RgbColor, background: RgbColor): RgbColor => {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const r = (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha;
  const g = (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha;
  const b = (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha;
  return { r, g, b, a: alpha };
};

const relativeLuminance = (color: RgbColor) => {
  const toLinear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getContrastRatio = (colorA: RgbColor, colorB: RgbColor) => {
  const lumA = relativeLuminance(colorA);
  const lumB = relativeLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
};

const updateContrastState = () => {
  if (!document?.documentElement) {
    return;
  }
  const styles = window.getComputedStyle(document.documentElement);
  const highlightFill = parseColor(styles.getPropertyValue('--highlight-fill')) ?? parseColor('#ffd668');
  const pageBackground = parseColor(styles.getPropertyValue('--page-bg')) ?? parseColor('#ffffff');
  if (!highlightFill || !pageBackground) {
    return;
  }

  const blended = blendOnBackground(highlightFill, pageBackground);
  const ratio = getContrastRatio(blended, pageBackground);
  const prefersContrast =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-contrast: more)').matches;
  const forcedColors =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(forced-colors: active)').matches;
  const boosted = forcedColors || prefersContrast || ratio < 3;

  document.documentElement.dataset.contrast = boosted ? 'boosted' : 'standard';

  if (contrastNote) {
    if (forcedColors) {
      contrastNote.textContent = 'Contrast check: using system colors.';
    } else if (boosted) {
      contrastNote.textContent = `Contrast check: boosted (${ratio.toFixed(1)}:1).`;
    } else {
      contrastNote.textContent = `Contrast check: ok (${ratio.toFixed(1)}:1).`;
    }
  }
};

const attachContrastWatcher = (query: string) => {
  if (typeof window.matchMedia !== 'function') {
    return;
  }
  const media = window.matchMedia(query);
  const handler = () => updateContrastState();
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler);
  } else if (typeof media.addListener === 'function') {
    media.addListener(handler);
  }
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

// Sanitize untrusted HTML from DOCX/URL/Text before rendering.
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

const applyInlineHighlight = (
  block: HTMLElement,
  startOffset: number,
  endOffset: number,
  sentenceId: string,
  className = 'docx-highlight',
) => {
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
  highlight.className = className;
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
  questionHighlightIds: Set<string> = new Set(),
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
    const className = questionHighlightIds.has(sentence.id)
      ? 'docx-highlight is-question'
      : 'docx-highlight';
    if (applyInlineHighlight(block.element, startOffset, endOffset, sentence.id, className)) {
      rendered += 1;
    }
  }

  const pageElement = page.element;
  if (pageElement) {
    pageElement.dataset.highlightCount = String(rendered);
  }

  return rendered;
};

const indexDocxPage = async (
  page: DocxPage,
  processId: number,
  sourceKind: ReadingSourceKind,
  allowWorker: boolean,
) => {
  const textMap = buildDocxPageTextMap(page.content);
  const sentences = segmentDocxPageText(textMap, page.pageNumber);
  const capped = clampSentencesForAutoIndexing(sentences);
  const effectiveSentences = capped.sentences;
  if (sentences.length > 0 && effectiveSentences.length === 0) {
    return null;
  }
  let embeddings: Float32Array[] | null = null;

  if (effectiveSentences.length) {
    try {
      embeddings = await computeEmbeddingsForSentences(effectiveSentences, { allowWorker });
    } catch (error) {
      console.debug(`Embedding failed for ${getReadingLabel(sourceKind)} page`, page.pageNumber, error);
    }
  }

  if (processId !== backgroundProcessId) {
    return null;
  }

  if (embeddings) {
    updateDocEmbeddingCentroid(page.pageNumber, embeddings);
  }
  const highlights = selectAutoHighlights(effectiveSentences, embeddings);
  const questionHighlights =
    currentQuestionEmbedding && currentQuestionQuery
      ? selectQuestionHighlights(effectiveSentences, embeddings, currentQuestionEmbedding)
      : [];
  const showQuestionHighlights = shouldShowQuestionHighlights();
  const displayHighlights =
    showQuestionHighlights && questionHighlights.length > 0
      ? mergeHighlightSets(highlights, questionHighlights)
      : highlights;
  const questionHighlightIds =
    showQuestionHighlights && questionHighlights.length > 0
      ? new Set(questionHighlights.map((sentence) => sentence.id))
      : new Set<string>();
  renderDocxPageHighlights(page, textMap, displayHighlights, questionHighlightIds);
  registerAutoSentenceCount(effectiveSentences.length);
  return {
    source: sourceKind,
    pageNumber: page.pageNumber,
    sentences: effectiveSentences,
    highlights,
    questionHighlights,
    embeddings,
  };
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
    if (autoSentenceCapReached) {
      notifySentenceCap();
      return;
    }

    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      `Indexing page ${page.pageNumber} of ${backgroundTotalPages}...`,
    );

    try {
      const entry = await indexDocxPage(page, processId, sourceKind, true);
      if (!entry) {
        if (autoSentenceCapReached) {
          notifySentenceCap();
        }
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
    if (autoSentenceCapReached) {
      notifySentenceCap();
      return;
    }
    await yieldToUi();
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

  currentDocxPageNumber = current;
  setPageIndicator(current, docxPages.length);
  if (currentViewMode === 'list') {
    renderHighlightListView();
  }
};

const scrollToDocxPage = (pageNumber: number) => {
  if (!docxViewer || docxPages.length === 0) {
    return;
  }
  const totalPages = docxPages.length;
  const clamped = Math.min(totalPages, Math.max(1, pageNumber));
  const target = docxPages.find((page) => page.pageNumber === clamped);
  if (!target) {
    return;
  }
  currentDocxPageNumber = target.pageNumber;
  setPageIndicator(currentDocxPageNumber, totalPages);
  docxViewer.scrollTo({ top: target.element.offsetTop });
  if (currentViewMode === 'list') {
    renderHighlightListView();
  }
};

const renderDocxDocument = async (html: string, sourceKind: ReadingSourceKind) => {
  if (!docxViewer) {
    return;
  }

  autoSentenceCount = 0;
  autoSentenceCapReached = false;
  resetDocCentroidSamples();

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

  const { cappedTotalPages } = getAutoPageLimit(docxPages.length);
  const pageCapNote = getAutoPageNote(docxPages.length, cappedTotalPages);
  const autoIndexedPages = docxPages.slice(0, cappedTotalPages);
  const processId = backgroundProcessId;
  backgroundTotalPages = cappedTotalPages;
  backgroundProcessedPages = 0;
  setProgress(
    0,
    backgroundTotalPages,
    appendNote(`Preparing page 1 of ${backgroundTotalPages}...`, pageCapNote),
  );
  setPageIndicator(1, docxPages.length);
  docxViewer.scrollTop = 0;

  const firstPage = autoIndexedPages[0];
  setStatus(`Highlighting ${sourceLabel} page 1...`);
  const firstEntry = await indexDocxPage(firstPage, processId, sourceKind, false);
  if (!firstEntry) {
    if (autoSentenceCapReached) {
      notifySentenceCap();
    }
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
  setProgress(backgroundProcessedPages, backgroundTotalPages, appendNote(progressMessage, pageCapNote));
  updateDocxPageIndicator();

  if (autoSentenceCapReached) {
    notifySentenceCap();
    return;
  }

  if (backgroundTotalPages > 1) {
    void startDocxIndexing(autoIndexedPages.slice(1), processId, sourceKind);
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

const sampleEmbeddingsEvenly = (embeddings: Float32Array[], targetCount: number) => {
  if (!embeddings.length || targetCount <= 0) {
    return [];
  }
  if (embeddings.length <= targetCount) {
    return embeddings.slice();
  }
  const step = embeddings.length / targetCount;
  const samples: Float32Array[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const sampleIndex = Math.min(embeddings.length - 1, Math.floor(index * step));
    samples.push(embeddings[sampleIndex]);
  }
  return samples;
};

const downsampleEmbeddingsEvenly = (embeddings: Float32Array[], targetCount: number) => {
  if (embeddings.length <= targetCount) {
    return embeddings;
  }
  const step = embeddings.length / targetCount;
  const samples: Float32Array[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const sampleIndex = Math.min(embeddings.length - 1, Math.floor(index * step));
    samples.push(embeddings[sampleIndex]);
  }
  return samples;
};

const updateDocEmbeddingCentroid = (pageNumber: number, embeddings: Float32Array[]) => {
  if (!embeddings.length || docSampledPages.has(pageNumber)) {
    return;
  }
  docSampledPages.add(pageNumber);
  const target = Math.min(performanceLimits.docCentroidSamples.perPage, embeddings.length);
  const samples = sampleEmbeddingsEvenly(embeddings, target);
  if (!samples.length) {
    return;
  }
  docEmbeddingSamples = docEmbeddingSamples.concat(samples);
  if (docEmbeddingSamples.length > performanceLimits.docCentroidSamples.max) {
    docEmbeddingSamples = downsampleEmbeddingsEvenly(
      docEmbeddingSamples,
      performanceLimits.docCentroidSamples.max,
    );
  }
  docEmbeddingCentroid = computeCentroid(docEmbeddingSamples);
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
  const globalCentroid = docEmbeddingCentroid ?? pageCentroid;

  return sentences.map((sentence, index) => {
    const embedding = embeddings[index];
    const centrality = pageCentroid ? cosineSimilarity(embedding, pageCentroid) : 0;
    const globality = globalCentroid ? cosineSimilarity(embedding, globalCentroid) : 0;
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

const normalizeQuestionInput = (value: string) => value.trim().replace(/\s+/g, ' ');

const computeQueryEmbedding = async (question: string) => {
  const normalized = normalizeQuestionInput(question);
  if (!normalized) {
    return null;
  }
  const embeddings = await computeEmbeddingsForInputs([`query: ${normalized}`], { allowWorker: false });
  return embeddings?.[0] ?? null;
};

const selectQuestionHighlights = (
  sentences: SentenceSegment[],
  embeddings: Float32Array[] | null,
  queryEmbedding: Float32Array | null,
) => {
  const targetCount = getHighlightTargetCount(sentences.length);
  if (!targetCount || !queryEmbedding) {
    return [];
  }
  if (!embeddings || embeddings.length !== sentences.length) {
    return [];
  }

  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      embedding: embeddings[index],
      score: cosineSimilarity(embeddings[index], queryEmbedding),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = selectHighlightsWithMmr(scored, targetCount, highlightMmrLambda).map(
    (entry) => entry.sentence,
  );
  return selected.length > 0 ? selected : scored.slice(0, targetCount).map((entry) => entry.sentence);
};

const mergeHighlightSets = (base: SentenceSegment[], overlay: SentenceSegment[]) => {
  if (!overlay.length) {
    return base;
  }
  const seen = new Set(base.map((sentence) => sentence.id));
  const merged = base.slice();
  for (const sentence of overlay) {
    if (seen.has(sentence.id)) {
      continue;
    }
    seen.add(sentence.id);
    merged.push(sentence);
  }
  return merged;
};

const shouldShowQuestionHighlights = () =>
  currentHighlightMode === 'question' && Boolean(currentQuestionEmbedding && currentQuestionQuery);

const getQuestionHighlightsForEntry = (entry: IndexedPage) =>
  shouldShowQuestionHighlights() ? entry.questionHighlights ?? [] : [];

const getQuestionHighlightIdsForEntry = (entry: IndexedPage) => {
  const questionHighlights = getQuestionHighlightsForEntry(entry);
  if (!questionHighlights.length) {
    return new Set<string>();
  }
  return new Set(questionHighlights.map((sentence) => sentence.id));
};

const updateAutoHighlights = (
  sentences: SentenceSegment[],
  embeddings: Float32Array[] | null,
) => {
  const highlights = selectAutoHighlights(sentences, embeddings);
  currentPageHighlightSentences = highlights;
  return highlights;
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
  const autoHighlights =
    currentPageHighlightSentences.length > 0
      ? currentPageHighlightSentences
      : currentPageSentences.slice(0, fallbackCount);
  const entry = currentPage ? indexedPages.get(currentPage.pageNumber) : null;
  const questionHighlights = entry ? getQuestionHighlightsForEntry(entry) : [];
  const displayHighlights =
    questionHighlights.length > 0 ? mergeHighlightSets(autoHighlights, questionHighlights) : autoHighlights;
  if (!displayHighlights.length) {
    highlightLayer.innerHTML = '';
    return { sentences: 0, rects: 0 };
  }

  const fragment = document.createDocumentFragment();
  let rectCount = 0;
  const sentenceIds = new Set(displayHighlights.map((sentence) => sentence.id));

  const renderRectsForSentences = (sentences: SentenceSegment[], className: string) => {
    for (const sentence of sentences) {
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
        rectEl.className = className;
        rectEl.style.left = `${rect.left}px`;
        rectEl.style.top = `${rect.top}px`;
        rectEl.style.width = `${rect.width}px`;
        rectEl.style.height = `${rect.height}px`;
        rectEl.dataset.sentenceId = sentence.id;
        fragment.append(rectEl);
        rectCount += 1;
      }
    }
  };

  renderRectsForSentences(displayHighlights, 'highlight-rect');
  if (questionHighlights.length > 0) {
    renderRectsForSentences(questionHighlights, 'highlight-rect is-question');
  }

  highlightLayer.innerHTML = '';
  highlightLayer.append(fragment);

  return { sentences: sentenceIds.size, rects: rectCount };
};

const getAutoHighlightsForEntry = (entry: IndexedPage) => {
  if (entry.highlights && entry.highlights.length > 0) {
    return entry.highlights;
  }
  const fallbackCount = getHighlightTargetCount(entry.sentences.length);
  if (!fallbackCount) {
    return [];
  }
  return entry.sentences.slice(0, fallbackCount);
};

const getActiveHighlightsForEntry = (entry: IndexedPage) => {
  const autoHighlights = getAutoHighlightsForEntry(entry);
  const questionHighlights = getQuestionHighlightsForEntry(entry);
  if (!questionHighlights.length) {
    return autoHighlights;
  }
  return mergeHighlightSets(autoHighlights, questionHighlights);
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
      highlights: getActiveHighlightsForEntry(entry).slice().sort(sortHighlightsByPosition),
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

const getCurrentPageNumber = () => {
  if (currentSourceKind === 'pdf') {
    return currentPage?.pageNumber ?? null;
  }
  if (currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text') {
    return currentDocxPageNumber || 1;
  }
  return null;
};

const getTotalPages = () => {
  if (currentSourceKind === 'pdf') {
    return pdfDoc?.numPages ?? null;
  }
  if (currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text') {
    return docxPages.length > 0 ? docxPages.length : null;
  }
  return null;
};

const getHighlightListState = (pageNumber: number | null) => {
  if (!pageNumber) {
    return { highlights: [] as SentenceSegment[], questionIds: new Set<string>(), ready: false };
  }

  const entry = indexedPages.get(pageNumber);
  if (entry) {
    return {
      highlights: getActiveHighlightsForEntry(entry),
      questionIds: getQuestionHighlightIdsForEntry(entry),
      ready: true,
    };
  }

  if (currentSourceKind === 'pdf' && currentPage?.pageNumber === pageNumber) {
    const fallbackCount = getHighlightTargetCount(currentPageSentences.length);
    const highlights =
      currentPageHighlightSentences.length > 0
        ? currentPageHighlightSentences
        : currentPageSentences.slice(0, fallbackCount);
    return { highlights, questionIds: new Set<string>(), ready: true };
  }

  return { highlights: [] as SentenceSegment[], questionIds: new Set<string>(), ready: false };
};

const renderHighlightListView = () => {
  if (!highlightListView || currentViewMode !== 'list') {
    return;
  }

  highlightListView.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const headerEl = document.createElement('div');
  headerEl.className = 'highlight-list-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'highlight-list-title';

  const metaEl = document.createElement('span');
  metaEl.className = 'highlight-list-meta';

  headerEl.append(titleEl, metaEl);
  fragment.append(headerEl);

  const itemsEl = document.createElement('div');
  itemsEl.className = 'highlight-list-items';
  itemsEl.setAttribute('role', 'list');

  const pageNumber = getCurrentPageNumber();
  const totalPages = getTotalPages();

  if (!currentSourceKind) {
    titleEl.textContent = 'Highlights list';
    metaEl.textContent = 'Upload a document to view highlights.';
  } else if (!pageNumber) {
    titleEl.textContent = 'Highlights list';
    metaEl.textContent = 'Page preview not ready yet.';
  } else {
    titleEl.textContent = `Highlights for page ${pageNumber}`;
    const { highlights, questionIds, ready } = getHighlightListState(pageNumber);
    const pageMeta = totalPages ? `Page ${pageNumber} of ${totalPages}` : `Page ${pageNumber}`;
    if (!ready) {
      metaEl.textContent = `${pageMeta} - Processing highlights.`;
    } else {
      metaEl.textContent = `${pageMeta} - ${highlights.length} highlights`;
    }

    if (!ready || highlights.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'highlight-list-empty';
      emptyEl.textContent = ready ? 'No highlights available on this page yet.' : 'Highlights are still processing.';
      itemsEl.append(emptyEl);
    } else {
      for (const sentence of highlights) {
        const isPinned = pinnedHighlightIds.has(sentence.id);
        const isQuestion = questionIds.has(sentence.id);
        const itemEl = document.createElement('div');
        itemEl.className = `highlight-list-item${isPinned ? ' pinned' : ''}${isQuestion ? ' is-question' : ''}`;
        itemEl.setAttribute('role', 'listitem');

        const textEl = document.createElement('p');
        textEl.className = 'highlight-list-text';
        textEl.textContent = sentence.text;

        const pinButton = document.createElement('button');
        pinButton.type = 'button';
        pinButton.className = 'strip-pin';
        pinButton.dataset.sentenceId = sentence.id;
        pinButton.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
        pinButton.setAttribute('aria-label', `${isPinned ? 'Unpin' : 'Pin'} highlight`);
        pinButton.textContent = isPinned ? 'Unpin' : 'Pin';

        itemEl.append(textEl, pinButton);
        itemsEl.append(itemEl);
      }
    }
  }

  fragment.append(itemsEl);
  highlightListView.append(fragment);
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
    const entry = indexedPages.get(section.pageNumber);
    const questionIds = entry ? getQuestionHighlightIdsForEntry(entry) : new Set<string>();

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
      const isQuestion = questionIds.has(sentence.id);
      if (isPinned) {
        totalPinned += 1;
        pinnedInGroup += 1;
      }

      const itemEl = document.createElement('div');
      itemEl.className = `strip-item${isPinned ? ' pinned' : ''}${isQuestion ? ' is-question' : ''}`;
      itemEl.setAttribute('role', 'listitem');

      const textEl = document.createElement('p');
      textEl.className = 'strip-text';
      textEl.textContent = sentence.text;

      const pinButton = document.createElement('button');
      pinButton.type = 'button';
      pinButton.className = 'strip-pin';
      pinButton.dataset.sentenceId = sentence.id;
      pinButton.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
      pinButton.setAttribute('aria-label', `${isPinned ? 'Unpin' : 'Pin'} highlight`);
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
    if (currentViewMode === 'list') {
      renderHighlightListView();
    }
    return;
  }

  studyStripEmpty.hidden = true;
  studyStripList.hidden = false;
  studyStripList.append(fragment);

  if (currentViewMode === 'list') {
    renderHighlightListView();
  }
};

const renderDocxHighlightsForMode = () => {
  if (!docxPages.length) {
    return;
  }
  const shouldUpdateDocx =
    currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text';
  if (!shouldUpdateDocx) {
    return;
  }

  for (const page of docxPages) {
    const entry = indexedPages.get(page.pageNumber);
    if (!entry || entry.source === 'pdf') {
      continue;
    }
    clearDocxHighlights(page);
    const textMap = buildDocxPageTextMap(page.content);
    const highlights = getActiveHighlightsForEntry(entry);
    const questionHighlightIds = getQuestionHighlightIdsForEntry(entry);
    renderDocxPageHighlights(page, textMap, highlights, questionHighlightIds);
  }
};

const applyHighlightMode = () => {
  if (currentSourceKind === 'pdf') {
    if (currentPage) {
      const entry = indexedPages.get(currentPage.pageNumber);
      if (entry) {
        currentPageHighlightSentences = getAutoHighlightsForEntry(entry);
      } else {
        currentPageHighlightSentences = selectAutoHighlights(
          currentPageSentences,
          currentPageEmbeddings,
        );
      }
      renderHighlights();
    }
  } else {
    renderDocxHighlightsForMode();
  }

  renderStudyStrip();
  if (currentViewMode === 'list') {
    renderHighlightListView();
  }
};

const clearQuestionHighlights = () => {
  questionRequestId += 1;
  currentQuestionQuery = null;
  currentQuestionEmbedding = null;
  for (const entry of indexedPages.values()) {
    entry.questionHighlights = [];
  }
};

const updateQuestionHighlightsForPages = async (
  queryEmbedding: Float32Array,
  requestId: number,
) => {
  const entries = Array.from(indexedPages.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  if (entries.length === 0) {
    return;
  }

  for (let index = 0; index < entries.length; index += 1) {
    if (requestId !== questionRequestId) {
      return;
    }
    const entry = entries[index];
    if (!entry.sentences.length) {
      entry.questionHighlights = [];
      continue;
    }

    let embeddings = entry.embeddings;
    if (!embeddings || embeddings.length !== entry.sentences.length) {
      try {
        embeddings = await computeEmbeddingsForSentences(entry.sentences, { allowWorker: true });
      } catch (error) {
        console.debug('Embedding failed for question mode page', entry.pageNumber, error);
      }
      if (requestId !== questionRequestId) {
        return;
      }
      if (embeddings) {
        entry.embeddings = embeddings;
        if (entry.source === 'pdf' && currentPage?.pageNumber === entry.pageNumber) {
          currentPageEmbeddings = embeddings;
        }
      }
    }

    entry.questionHighlights = selectQuestionHighlights(entry.sentences, embeddings ?? null, queryEmbedding);
    if (entry.source === 'pdf' && currentPage?.pageNumber === entry.pageNumber) {
      currentPageHighlightSentences = getAutoHighlightsForEntry(entry);
    }

    if (index % 2 === 1) {
      await yieldToUi();
    }
  }

  if (currentSourceKind === 'pdf') {
    renderHighlights();
  } else {
    renderDocxHighlightsForMode();
  }
  renderStudyStrip();
  if (currentViewMode === 'list') {
    renderHighlightListView();
  }
};

const applyQuestionHighlight = async () => {
  if (!questionInput) {
    return;
  }

  const normalized = normalizeQuestionInput(questionInput.value);
  if (!normalized) {
    clearQuestionHighlights();
    if (questionButton) {
      questionButton.disabled = false;
    }
    updateHighlightModeControls();
    applyHighlightMode();
    return;
  }

  questionInput.value = normalized;
  const requestId = (questionRequestId += 1);
  currentQuestionQuery = normalized;
  if (questionButton) {
    questionButton.disabled = true;
  }
  if (currentHighlightMode !== 'question') {
    setHighlightMode('question');
  } else {
    updateHighlightModeControls();
    applyHighlightMode();
  }

  try {
    setStatus(`Highlighting answers for "${normalized}"...`);
    const queryEmbedding = await computeQueryEmbedding(normalized);
    if (requestId !== questionRequestId) {
      return;
    }
    if (!queryEmbedding) {
      currentQuestionEmbedding = null;
      setStatus('Unable to compute question embedding.');
      updateHighlightModeControls();
      return;
    }
    currentQuestionEmbedding = queryEmbedding;
    await updateQuestionHighlightsForPages(queryEmbedding, requestId);
    if (requestId !== questionRequestId) {
      return;
    }
    setStatus(`Question highlights ready for "${normalized}".`);
    updateHighlightModeControls();
  } catch (error) {
    if (requestId !== questionRequestId) {
      return;
    }
    console.error(error);
    setStatus('Unable to highlight answers for that question.');
  } finally {
    if (requestId === questionRequestId && questionButton) {
      questionButton.disabled = false;
    }
  }
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
    if (currentHighlightMode === 'question') {
      highlightModeNote.textContent = currentQuestionQuery
        ? `Question mode adds answers for "${currentQuestionQuery}" on top of auto highlights.`
        : 'Question mode layers answer highlights on top of auto highlights.';
    } else {
      highlightModeNote.textContent = 'Auto mode selects key sentences. Question adds answers on top.';
    }
  }
  if (questionGroup) {
    questionGroup.hidden = currentHighlightMode !== 'question';
  }
  if (questionNote) {
    if (currentHighlightMode !== 'question') {
      questionNote.textContent = 'Switch to Question mode to layer answers on top of auto highlights.';
    } else if (currentQuestionQuery) {
      questionNote.textContent = `Showing answers for "${currentQuestionQuery}" on top of auto highlights.`;
    } else {
      questionNote.textContent = 'Enter a question to layer answers on top of auto highlights.';
    }
  }
};

const setHighlightMode = (mode: HighlightMode) => {
  if (currentHighlightMode === mode) {
    return;
  }
  currentHighlightMode = mode;
  updateHighlightModeControls();
  applyHighlightMode();
  if (currentHighlightMode === 'question' && questionInput) {
    questionInput.focus();
  }
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
    entry.highlights = selectAutoHighlights(entry.sentences, embeddings);

    if (currentQuestionEmbedding && currentQuestionQuery) {
      entry.questionHighlights = selectQuestionHighlights(
        entry.sentences,
        embeddings,
        currentQuestionEmbedding,
      );
    } else {
      entry.questionHighlights = [];
    }

    const activeHighlights = getActiveHighlightsForEntry(entry);
    if (entry.source === 'pdf' && currentPage?.pageNumber === entry.pageNumber) {
      currentPageHighlightSentences = getAutoHighlightsForEntry(entry);
    }

    if (docxPagesByNumber && entry.source !== 'pdf') {
      const page = docxPagesByNumber.get(entry.pageNumber);
      if (!page) {
        continue;
      }
      clearDocxHighlights(page);
      const textMap = buildDocxPageTextMap(page.content);
      const questionHighlightIds = getQuestionHighlightIdsForEntry(entry);
      renderDocxPageHighlights(page, textMap, activeHighlights, questionHighlightIds);
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

const updateViewModeControls = () => {
  viewerModeButtons.forEach((button) => {
    const mode = button.dataset.viewMode as ViewerMode | undefined;
    if (!mode) {
      return;
    }
    button.setAttribute('aria-pressed', mode === currentViewMode ? 'true' : 'false');
  });
};

const setViewMode = (mode: ViewerMode) => {
  if (currentViewMode === mode) {
    return;
  }
  currentViewMode = mode;
  updateViewModeControls();
  updateViewerModeVisibility();
  if (currentViewMode === 'list') {
    renderHighlightListView();
  }
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

const sanitizeDownloadBaseName = (raw: string) => {
  const withoutSeparators = raw.replace(/[\\/]+/g, '-');
  const withoutUnsafe = withoutSeparators.replace(/[<>:"|?*\u0000-\u001F]/g, '');
  const collapsedWhitespace = withoutUnsafe.replace(/\s+/g, ' ').trim();
  return collapsedWhitespace.replace(/[. ]+$/g, '');
};

const getDownloadFileName = (name: string | null, sourceKind: DocumentSourceKind) => {
  if (!name) {
    return 'highlighted.pdf';
  }
  let trimmed = name.trim();
  if (!trimmed) {
    return 'highlighted.pdf';
  }

  if (sourceKind === 'url' || sourceKind === 'text') {
    const sanitized = sanitizeDownloadBaseName(trimmed);
    if (!sanitized) {
      return 'highlighted.pdf';
    }
    trimmed = sanitized;
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
      await yieldToUi();
    }

    const outputBytes = await pdfDocument.save();
    const blob = new Blob([outputBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getDownloadFileName(currentFileName, sourceKind);
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
      const highlightSentences = getActiveHighlightsForEntry(entry);
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
    link.download = getDownloadFileName(currentFileName, currentSourceKind);
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
  updatePdfScanWarning(textMap);

  const sentences = segmentPageText(textMap, pageNumber);
  const capped = clampSentencesForAutoIndexing(sentences);
  const effectiveSentences = capped.sentences;
  if (sentences.length > 0 && effectiveSentences.length === 0) {
    return null;
  }
  let embeddings: Float32Array[] | null = null;

  if (effectiveSentences.length) {
    try {
      embeddings = await computeEmbeddingsForSentences(effectiveSentences, { allowWorker: true });
    } catch (error) {
      console.debug('Embedding failed for page', pageNumber, error);
    }
    if (processId !== backgroundProcessId) {
      return null;
    }
  }

  if (embeddings) {
    updateDocEmbeddingCentroid(pageNumber, embeddings);
  }
  const highlights = selectAutoHighlights(effectiveSentences, embeddings);
  const questionHighlights =
    currentQuestionEmbedding && currentQuestionQuery
      ? selectQuestionHighlights(effectiveSentences, embeddings, currentQuestionEmbedding)
      : [];
  registerAutoSentenceCount(effectiveSentences.length);
  return {
    source: 'pdf',
    pageNumber,
    textMap,
    sentences: effectiveSentences,
    highlights,
    questionHighlights,
    embeddings,
  };
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
  const { cappedTotalPages } = getAutoPageLimit(totalPages);
  const pageCapNote = getAutoPageNote(totalPages, cappedTotalPages);
  backgroundTotalPages = cappedTotalPages;

  if (autoSentenceCapReached) {
    notifySentenceCap();
    return;
  }

  if (totalPages <= 1 || startPage > cappedTotalPages) {
    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      appendNote('All pages indexed.', pageCapNote),
    );
    return;
  }

  for (let pageNumber = startPage; pageNumber <= cappedTotalPages; pageNumber += 1) {
    if (processId !== backgroundProcessId) {
      return;
    }
    if (autoSentenceCapReached) {
      notifySentenceCap();
      return;
    }

    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      `Indexing page ${pageNumber} of ${backgroundTotalPages}...`,
    );

    try {
      const entry = await indexPdfPage(doc, pageNumber, processId);
      if (!entry) {
        if (autoSentenceCapReached) {
          notifySentenceCap();
        }
        return;
      }
      indexedPages.set(pageNumber, entry);
      renderStudyStrip();
    } catch (error) {
      console.error('Failed to index page', pageNumber, error);
    }

    backgroundProcessedPages = Math.min(backgroundTotalPages, backgroundProcessedPages + 1);
    setProgress(
      backgroundProcessedPages,
      backgroundTotalPages,
      `Indexed ${backgroundProcessedPages} of ${backgroundTotalPages} pages.`,
    );
    if (autoSentenceCapReached) {
      notifySentenceCap();
      return;
    }
    await yieldToUi();
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

const goToPdfPage = async (pageNumber: number) => {
  if (!pdfDoc) {
    return;
  }
  const totalPages = pdfDoc.numPages;
  const clamped = Math.min(totalPages, Math.max(1, pageNumber));
  if (currentPage?.pageNumber === clamped) {
    return;
  }

  const navigationId = (pdfNavigationId += 1);
  setStatus(`Rendering page ${clamped} of ${totalPages}...`);

  const page = await pdfDoc.getPage(clamped);
  if (navigationId !== pdfNavigationId) {
    return;
  }

  currentPage = page;
  setPageIndicator(clamped, totalPages);
  await renderPage(page);
  if (navigationId !== pdfNavigationId) {
    return;
  }

  const cached = indexedPages.get(clamped);
  if (cached && cached.source === 'pdf') {
    currentPageTextMap = cached.textMap;
    currentPageSentences = cached.sentences;
    currentPageEmbeddings = cached.embeddings;
    if (
      currentHighlightMode === 'question' &&
      currentQuestionEmbedding &&
      currentQuestionQuery &&
      cached.embeddings &&
      (!cached.questionHighlights || cached.questionHighlights.length === 0)
    ) {
      cached.questionHighlights = selectQuestionHighlights(
        cached.sentences,
        cached.embeddings,
        currentQuestionEmbedding,
      );
    }
    currentPageHighlightSentences = getAutoHighlightsForEntry(cached);
    updatePdfScanWarning(currentPageTextMap);
  } else {
    currentPageTextMap = await extractPageTextMap(page);
    if (navigationId !== pdfNavigationId) {
      return;
    }
    updatePdfScanWarning(currentPageTextMap);
    currentPageSentences = segmentPageText(currentPageTextMap, clamped);
    currentPageEmbeddings = null;
    const autoHighlights = updateAutoHighlights(currentPageSentences, null);
    const entry: IndexedPage = {
      source: 'pdf',
      pageNumber: clamped,
      textMap: currentPageTextMap,
      sentences: currentPageSentences,
      highlights: autoHighlights,
      questionHighlights: [],
      embeddings: null,
    };
    indexedPages.set(clamped, entry);
    currentPageHighlightSentences = getAutoHighlightsForEntry(entry);
  }

  const highlightStats = renderHighlights();
  renderStudyStrip();
  if (currentViewMode === 'list') {
    renderHighlightListView();
  }
  setStatus(`Rendered page ${clamped} of ${totalPages}. Highlighted ${highlightStats.sentences} sentences.`);
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
    const { cappedTotalPages } = getAutoPageLimit(pdfDoc.numPages);
    const pageCapNote = getAutoPageNote(pdfDoc.numPages, cappedTotalPages);
    backgroundTotalPages = cappedTotalPages;
    backgroundProcessedPages = 0;
    setProgress(
      0,
      backgroundTotalPages,
      appendNote(`Preparing page 1 of ${backgroundTotalPages}...`, pageCapNote),
    );
    setViewerMode('pdf');
    setStatus(`Rendering page 1 of ${pdfDoc.numPages}...`);
    await renderPage(currentPage);
    currentPageTextMap = await extractPageTextMap(currentPage);
    updatePdfScanWarning(currentPageTextMap);
    currentPageSentences = segmentPageText(currentPageTextMap, currentPage.pageNumber);
    const capped = clampSentencesForAutoIndexing(currentPageSentences);
    currentPageSentences = capped.sentences;
    const autoHighlights = updateAutoHighlights(currentPageSentences, null);
    const entry: IndexedPage = {
      source: 'pdf',
      pageNumber: currentPage.pageNumber,
      textMap: currentPageTextMap,
      sentences: currentPageSentences,
      highlights: autoHighlights,
      questionHighlights: [],
      embeddings: null,
    };
    indexedPages.set(currentPage.pageNumber, entry);
    currentPageHighlightSentences = getAutoHighlightsForEntry(entry);
    registerAutoSentenceCount(currentPageSentences.length);
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
    setProgress(backgroundProcessedPages, backgroundTotalPages, appendNote(progressMessage, pageCapNote));
    const embeddingsTask = runPageEmbeddings(currentPage.pageNumber, currentPageSentences, statusPrefix);
    if (autoSentenceCapReached) {
      notifySentenceCap();
      return;
    }
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

  zone.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    zone.click();
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

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

const handleViewerKeydown = (event: KeyboardEvent) => {
  if (!currentSourceKind) {
    return;
  }
  if (isEditableTarget(event.target)) {
    return;
  }
  const activeElement = document.activeElement;
  if (activeElement && activeElement !== document.body && viewerStage && !viewerStage.contains(activeElement)) {
    return;
  }

  const currentPageNumber = getCurrentPageNumber();
  const totalPages = getTotalPages();
  if (!currentPageNumber || !totalPages) {
    return;
  }

  const isPdf = currentSourceKind === 'pdf';
  const isReading =
    currentSourceKind === 'docx' || currentSourceKind === 'url' || currentSourceKind === 'text';
  let nextPage: number | null = null;

  if (event.key === 'Home') {
    nextPage = 1;
  } else if (event.key === 'End') {
    nextPage = totalPages;
  } else if (event.key === 'PageUp') {
    nextPage = currentPageNumber - 1;
  } else if (event.key === 'PageDown') {
    nextPage = currentPageNumber + 1;
  } else if (isPdf && event.key === 'ArrowLeft') {
    nextPage = currentPageNumber - 1;
  } else if (isPdf && event.key === 'ArrowRight') {
    nextPage = currentPageNumber + 1;
  }

  if (!nextPage || nextPage < 1 || nextPage > totalPages) {
    return;
  }

  event.preventDefault();
  if (isPdf) {
    void goToPdfPage(nextPage);
  } else if (isReading) {
    scrollToDocxPage(nextPage);
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

questionButton?.addEventListener('click', () => {
  void applyQuestionHighlight();
});

questionInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return;
  }
  event.preventDefault();
  void applyQuestionHighlight();
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

viewerModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.viewMode as ViewerMode | undefined;
    if (!mode) {
      return;
    }
    setViewMode(mode);
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

highlightListView?.addEventListener('click', (event) => {
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

window.addEventListener('keydown', handleViewerKeydown);
attachContrastWatcher('(prefers-contrast: more)');
attachContrastWatcher('(forced-colors: active)');

updateHighlightModeControls();
updateHighlightIntensityControls();
updateViewModeControls();
updateViewerModeVisibility();
updateContrastState();
renderStudyStrip();
