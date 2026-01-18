const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">FocusHighlighter</p>
      <h1>Drop a document. Get highlights.</h1>
      <p class="lede">
        Frontend scaffold ready for PDF.js rendering, embeddings, and highlight overlays.
      </p>
    </header>
    <section class="card">
      <h2>Scaffold checklist</h2>
      <ul>
        <li>TypeScript configured</li>
        <li>Vite dev server and build pipeline</li>
        <li>ESLint rules for app code</li>
      </ul>
    </section>
  </main>
`;
