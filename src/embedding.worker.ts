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

const embeddingModelId = 'Xenova/multilingual-e5-small';

let embeddingPipelinePromise: Promise<EmbeddingPipeline> | null = null;
let embeddingBackend: EmbeddingDevice | null = null;
let activeQueue = Promise.resolve();

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

const getEmbeddingPipeline = async (device: EmbeddingDevice) => {
  if (embeddingPipelinePromise) {
    return embeddingPipelinePromise;
  }

  embeddingPipelinePromise = (async () => {
    try {
      const { extractor, device: resolvedDevice } = await createEmbeddingPipeline(device);
      embeddingBackend = resolvedDevice;
      return extractor;
    } catch (error) {
      if (device === 'webgpu') {
        const { extractor, device: resolvedDevice } = await createEmbeddingPipeline('wasm');
        embeddingBackend = resolvedDevice;
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

const poolTokenEmbeddings = (batch: TokenEmbeddingBatch, attentionMask: number[][] | null) => {
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

const computeEmbeddings = async (inputs: string[], options: { device: EmbeddingDevice; batchSize: number }) => {
  if (!inputs.length) {
    return null;
  }

  const extractor = await getEmbeddingPipeline(options.device);
  const batchSize = Math.max(1, Math.min(options.batchSize, inputs.length));
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
  }

  return pooledEmbeddings;
};

const flattenEmbeddings = (embeddings: Float32Array[]) => {
  if (!embeddings.length) {
    return null;
  }
  const dim = embeddings[0].length;
  const flattened = new Float32Array(embeddings.length * dim);
  embeddings.forEach((vector, index) => {
    flattened.set(vector, index * dim);
  });
  return { buffer: flattened.buffer, count: embeddings.length, dim };
};

const postResult = (message: EmbeddingWorkerResponse, transfer?: Transferable[]) => {
  const ctx = self as DedicatedWorkerGlobalScope;
  ctx.postMessage(message, transfer ?? []);
};

const handleEmbedRequest = async (message: EmbeddingWorkerRequest) => {
  try {
    if (!Array.isArray(message.inputs) || message.inputs.length === 0) {
      throw new Error('No inputs provided.');
    }

    const embeddings = await computeEmbeddings(message.inputs, {
      device: message.device,
      batchSize: message.batchSize,
    });
    if (!embeddings) {
      throw new Error('Embeddings could not be generated.');
    }

    const flattened = flattenEmbeddings(embeddings);
    if (!flattened) {
      throw new Error('Embeddings could not be serialized.');
    }

    postResult(
      {
        type: 'embed-result',
        id: message.id,
        device: embeddingBackend ?? message.device,
        count: flattened.count,
        dim: flattened.dim,
        buffer: flattened.buffer,
      },
      [flattened.buffer],
    );
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Embedding worker failed.';
    postResult({
      type: 'embed-result',
      id: message.id,
      device: embeddingBackend ?? message.device,
      count: 0,
      dim: 0,
      buffer: new ArrayBuffer(0),
      error: messageText,
    });
  }
};

self.addEventListener('message', (event: MessageEvent<EmbeddingWorkerRequest>) => {
  const message = event.data;
  if (!message || message.type !== 'embed') {
    return;
  }
  activeQueue = activeQueue.then(() => handleEmbedRequest(message));
});
