import { describe, expect, it } from 'vitest';
import {
  buildSentenceScores,
  getDownloadFileName,
  getLengthPrior,
  getParagraphRanges,
  getPositionPrior,
  sanitizeDocxHtml,
  sanitizeDocxHref,
  sanitizeDownloadBaseName,
  sanitizeUrlHref,
  segmentDocxPageText,
  segmentPageText,
  selectHighlightsWithMmr,
} from './highlight-utils';

describe('segmentation', () => {
  it('splits paragraphs into sentence segments with offsets', () => {
    const fullText = 'First sentence. Second sentence?\n\nNew para! Another.';
    const sentences = segmentPageText({ fullText }, 2, null);

    expect(sentences).toHaveLength(4);
    expect(sentences[0].page).toBe(2);
    expect(sentences[0].paragraphIndex).toBe(0);
    expect(sentences[2].paragraphIndex).toBe(1);
    expect(sentences[1].text).toBe('Second sentence?');

    for (const sentence of sentences) {
      expect(fullText.slice(sentence.charStart, sentence.charEnd)).toBe(sentence.text);
    }
  });

  it('reuses segmentation logic for docx text maps', () => {
    const fullText = 'Docx line one. Docx line two.';
    const sentences = segmentDocxPageText({ fullText }, 1, null);
    expect(sentences.map((sentence) => sentence.text)).toEqual(['Docx line one.', 'Docx line two.']);
  });

  it('detects paragraph ranges between blank lines', () => {
    const fullText = 'Para one.\n\nPara two.\n\n';
    const ranges = getParagraphRanges(fullText);
    expect(ranges.map((range) => fullText.slice(range.start, range.end))).toEqual([
      'Para one.',
      'Para two.',
    ]);
  });
});

describe('scoring and MMR selection', () => {
  it('computes position and length priors', () => {
    expect(getPositionPrior(0, 1)).toBeCloseTo(0.6);
    expect(getPositionPrior(0, 5)).toBe(1);
    expect(getPositionPrior(4, 5)).toBe(0.3);

    const shortScore = getLengthPrior('Tiny');
    const longScore = getLengthPrior(
      'This is a longer sentence with plenty of letters and words for scoring.',
    );
    expect(longScore).toBeGreaterThan(shortScore);
  });

  it('weights global centroid influence in sentence scores', () => {
    const text = 'This sentence is long enough to score consistently across tests.';
    const sentences = [
      {
        id: 's1',
        page: 1,
        paragraphIndex: 0,
        sentenceIndex: 0,
        charStart: 0,
        charEnd: text.length,
        text,
      },
      {
        id: 's2',
        page: 1,
        paragraphIndex: 0,
        sentenceIndex: 1,
        charStart: 0,
        charEnd: text.length,
        text,
      },
    ];
    const embeddings = [Float32Array.from([1, 0]), Float32Array.from([0, 1])];
    const localScores = buildSentenceScores(sentences, embeddings);
    const globalScores = buildSentenceScores(sentences, embeddings, Float32Array.from([1, 0]));

    expect(globalScores[0].score).toBeGreaterThan(globalScores[1].score);
    expect(globalScores[0].score - globalScores[1].score).toBeGreaterThan(
      localScores[0].score - localScores[1].score,
    );
  });

  it('selects diverse highlights with MMR', () => {
    const makeSentence = (id: string) => ({
      id,
      page: 1,
      paragraphIndex: 0,
      sentenceIndex: 0,
      charStart: 0,
      charEnd: 1,
      text: id,
    });
    const candidates = [
      {
        sentence: makeSentence('A'),
        embedding: Float32Array.from([1, 0]),
        score: 0.9,
      },
      {
        sentence: makeSentence('B'),
        embedding: Float32Array.from([0.9, 0.1]),
        score: 0.85,
      },
      {
        sentence: makeSentence('C'),
        embedding: Float32Array.from([0, 1]),
        score: 0.8,
      },
    ];

    const selected = selectHighlightsWithMmr(candidates, 2, 0.5);
    expect(selected.map((entry) => entry.sentence.id)).toEqual(['A', 'C']);
  });
});

describe('sanitization', () => {
  it('sanitizes docx href values', () => {
    expect(sanitizeDocxHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeDocxHref('data:text/html;base64,abcd')).toBeNull();
    expect(sanitizeDocxHref('#anchor')).toBe('#anchor');
    expect(sanitizeDocxHref('https://example.com')).toBe('https://example.com/');
  });

  it('removes unsafe markup from docx html', () => {
    const dirty =
      '<p onclick="alert(1)">Hello</p><script>alert(1)</script>' +
      '<a href="javascript:alert(1)">bad</a>' +
      '<a href="https://example.com">good</a>';
    const cleaned = sanitizeDocxHtml(dirty);

    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('onclick=');
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).toContain('https://example.com/');
    expect(cleaned).toContain('rel="noreferrer noopener"');
    expect(cleaned).toContain('target="_blank"');
  });

  it('sanitizes markdown link hrefs', () => {
    const baseUrl = new URL('https://example.com/base');
    expect(sanitizeUrlHref('/path', baseUrl)).toBe('https://example.com/path');
    expect(sanitizeUrlHref('javascript:alert(1)', baseUrl)).toBeNull();
  });
});

describe('filename handling', () => {
  it('sanitizes base names for downloads', () => {
    expect(sanitizeDownloadBaseName('Bad/Name\\Test:?.pdf')).toBe('Bad-Name-Test.pdf');
    expect(sanitizeDownloadBaseName('  Report...  ')).toBe('Report');
  });

  it('builds highlighted download filenames per source', () => {
    expect(getDownloadFileName('report.pdf', 'pdf')).toBe('highlighted-report.pdf');
    expect(getDownloadFileName('bad/name', 'url')).toBe('highlighted-bad-name.pdf');
    expect(getDownloadFileName(' ', 'text')).toBe('highlighted.pdf');
  });
});
