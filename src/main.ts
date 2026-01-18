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
          <canvas id="pdf-canvas" class="pdf-canvas" aria-label="PDF page preview"></canvas>
        </div>
      </article>
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
const pdfCanvas = document.querySelector<HTMLCanvasElement>('#pdf-canvas');
const pdfContext = pdfCanvas?.getContext('2d');

let pdfDoc: PDFDocumentProxy | null = null;
let currentPage: PDFPageProxy | null = null;
let renderTask: RenderTask | null = null;
let resizeTimer: number | undefined;

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

const setPageIndicator = (current: number, total: number | null) => {
  if (!pageIndicator) {
    return;
  }
  pageIndicator.textContent = `Page ${current} / ${total ?? '-'}`;
};

const resetViewer = () => {
  pdfDoc = null;
  currentPage = null;
  if (viewerStage) {
    viewerStage.classList.remove('is-ready');
  }
  if (viewerPlaceholder) {
    viewerPlaceholder.textContent = 'Page 1 will appear here after upload.';
  }
  if (pdfCanvas && pdfContext) {
    pdfContext.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
  }
  setPageIndicator(1, null);
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

  pdfCanvas.width = Math.floor(viewport.width * outputScale);
  pdfCanvas.height = Math.floor(viewport.height * outputScale);
  pdfCanvas.style.width = `${viewport.width}px`;
  pdfCanvas.style.height = `${viewport.height}px`;

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

  setFileName(file.name);
  setStatus('Loading PDF...');
  resetViewer();

  try {
    const buffer = await file.arrayBuffer();
    pdfDoc?.destroy();
    const loadingTask = getDocument({ data: buffer });
    pdfDoc = await loadingTask.promise;
    currentPage = await pdfDoc.getPage(1);
    setPageIndicator(1, pdfDoc.numPages);
    if (viewerStage) {
      viewerStage.classList.add('is-ready');
    }
    setStatus(`Rendered page 1 of ${pdfDoc.numPages}.`);
    await renderPage(currentPage);
  } catch (error) {
    console.error(error);
    setStatus('Unable to render this PDF. Try another file.');
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

window.addEventListener('resize', () => {
  if (!currentPage) {
    return;
  }
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    void renderPage(currentPage);
  }, 150);
});
