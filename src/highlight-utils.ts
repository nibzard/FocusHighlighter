export type ParagraphRange = {
  start: number;
  end: number;
};

export type SegmentedTextChunk = {
  text: string;
  index: number;
};

export type SentenceSegmenter = {
  segment: (input: string) => Iterable<{ segment: string; index: number }>;
};

export type SentenceSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'sentence' },
) => SentenceSegmenter;

export type SentenceSegment = {
  id: string;
  page: number;
  paragraphIndex: number;
  sentenceIndex: number;
  charStart: number;
  charEnd: number;
  text: string;
};

export type PageTextMap = {
  fullText: string;
};

export type DocxBlock = {
  text: string;
  charStart: number;
  charEnd: number;
  paragraphIndex: number;
};

export type DocxPageTextMap = {
  fullText: string;
  blocks?: DocxBlock[];
};

export type ScoredSentence = {
  sentence: SentenceSegment;
  embedding: Float32Array;
  score: number;
};

export type DocumentSourceKind = 'pdf' | 'docx' | 'url' | 'text' | null;

export const getSentenceSegmenter = (): SentenceSegmenter | null => {
  if (typeof Intl === 'undefined') {
    return null;
  }

  const segmenterConstructor = (Intl as { Segmenter?: SentenceSegmenterConstructor }).Segmenter;
  if (!segmenterConstructor) {
    return null;
  }

  return new segmenterConstructor(undefined, { granularity: 'sentence' });
};

export const getParagraphRanges = (fullText: string): ParagraphRange[] => {
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

export const getFallbackSentenceChunks = (paragraphText: string): SegmentedTextChunk[] => {
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

export const getSentenceChunks = (
  paragraphText: string,
  segmenter: SentenceSegmenter | null = null,
): SegmentedTextChunk[] => {
  if (!segmenter) {
    return getFallbackSentenceChunks(paragraphText);
  }

  return Array.from(segmenter.segment(paragraphText), (segment) => ({
    text: segment.segment,
    index: segment.index,
  }));
};

export const createSentenceId = (
  pageNumber: number,
  paragraphIndex: number,
  sentenceIndex: number,
  charStart: number,
  charEnd: number,
) => `p${pageNumber}-p${paragraphIndex}-s${sentenceIndex}-${charStart}-${charEnd}`;

const createDocxSentenceId = (
  paragraphIndex: number,
  sentenceIndex: number,
  localStart: number,
  localEnd: number,
) => `d${paragraphIndex}-s${sentenceIndex}-${localStart}-${localEnd}`;

export const segmentPageText = (
  pageTextMap: PageTextMap,
  pageNumber: number,
  segmenter: SentenceSegmenter | null = null,
): SentenceSegment[] => {
  const sentences: SentenceSegment[] = [];
  const paragraphRanges = getParagraphRanges(pageTextMap.fullText);
  let paragraphIndex = 0;

  for (const range of paragraphRanges) {
    const paragraphText = pageTextMap.fullText.slice(range.start, range.end);
    if (!paragraphText.trim()) {
      continue;
    }

    const sentenceChunks = getSentenceChunks(paragraphText, segmenter);
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

export const segmentDocxPageText = (
  textMap: DocxPageTextMap,
  pageNumber: number,
  segmenter: SentenceSegmenter | null = null,
): SentenceSegment[] => {
  if (!textMap.blocks || textMap.blocks.length === 0) {
    return segmentPageText(textMap, pageNumber, segmenter);
  }

  const sentences: SentenceSegment[] = [];

  for (const block of textMap.blocks) {
    if (!block.text.trim()) {
      continue;
    }
    const sentenceChunks = getSentenceChunks(block.text, segmenter);
    let sentenceIndex = 0;

    for (const chunk of sentenceChunks) {
      const rawText = chunk.text;
      const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
      const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
      const trimmedText = rawText.slice(leadingWhitespace, rawText.length - trailingWhitespace);

      if (!trimmedText) {
        continue;
      }

      const localStart = chunk.index + leadingWhitespace;
      const localEnd = chunk.index + rawText.length - trailingWhitespace;
      const charStart = block.charStart + localStart;
      const charEnd = block.charStart + localEnd;

      sentences.push({
        id: createDocxSentenceId(block.paragraphIndex, sentenceIndex, localStart, localEnd),
        page: pageNumber,
        paragraphIndex: block.paragraphIndex,
        sentenceIndex,
        charStart,
        charEnd,
        text: trimmedText,
      });
      sentenceIndex += 1;
    }
  }

  return sentences;
};

export const l2NormalizeInPlace = (vector: Float32Array) => {
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

export const computeCentroid = (embeddings: Float32Array[]) => {
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

export const cosineSimilarity = (a: ArrayLike<number>, b: ArrayLike<number>) => {
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

export const getPositionPrior = (sentenceIndex: number, sentenceCount: number) => {
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

export const getLengthPrior = (text: string) => {
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

export const buildSentenceScores = (
  sentences: SentenceSegment[],
  embeddings: Float32Array[],
  globalCentroidOverride: Float32Array | null = null,
) => {
  const pageCentroid = computeCentroid(embeddings);
  const globalCentroid = globalCentroidOverride ?? pageCentroid;

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

export const selectHighlightsWithMmr = (
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

export const sanitizeDocxHref = (href: string) => {
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

export const sanitizeDocxHtml = (html: string) => {
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

    if (tag === 'a') {
      const rawHref = element.getAttribute('href') ?? '';
      const safeHref = sanitizeDocxHref(rawHref);
      for (const attr of Array.from(element.attributes)) {
        element.removeAttribute(attr.name);
      }
      if (safeHref) {
        element.setAttribute('href', safeHref);
        element.setAttribute('rel', 'noreferrer noopener');
        element.setAttribute('target', '_blank');
      }
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
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

export const sanitizeUrlHref = (href: string, baseUrl: URL | null) => {
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

export const sanitizeDownloadBaseName = (raw: string) => {
  const withoutSeparators = raw.replace(/[\\/]+/g, '-');
  const withoutUnsafe = withoutSeparators.replace(/[<>:"|?*\u0000-\u001F]/g, '');
  const collapsedWhitespace = withoutUnsafe.replace(/\s+/g, ' ').trim();
  return collapsedWhitespace.replace(/[. ]+$/g, '');
};

export const getDownloadFileName = (name: string | null, sourceKind: DocumentSourceKind) => {
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
