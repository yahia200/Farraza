import { REQUIREMENT_QUERY_INSTRUCTION } from '@repo/shared';
import {
  EmbedderError,
  type Embedder,
  type EmbedKind,
  type EmbedResult,
} from './embedder.js';

/*
 * Embedder backed by Ollama's POST /api/embed.
 * Docs: https://docs.ollama.com/api/embed (EmbedRequest / EmbedResponse) and
 * https://docs.ollama.com/capabilities/embeddings (vectors are L2-normalised).
 * Measurements for qwen3-embedding:0.6b:
 * .scratch/candidate-matching/layer3-embeddings-notes.md.
 */

/*
 * REQUIREMENT_QUERY_INSTRUCTION (from @repo/shared, spec "Shared") is prepended
 * to Requirement sentences (kind 'query') only. Its wording is provisional:
 * re-test on real CVs (spec: .scratch/candidate-matching/layer3-spec.md,
 * "Open items" 1; measurements in the notes file, "Instruction prefix").
 */

export interface OllamaEmbedderOptions {
  /** Origin of the Ollama server, e.g. http://localhost:11434. */
  baseUrl: string;
  /** Model tag, e.g. qwen3-embedding:0.6b. */
  model: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * Upper bound for one request, body included, so a hung Ollama cannot stall
   * a worker. Default 60 s: a cold model load plus a CV's chunks took a few
   * seconds when measured (layer3-embeddings-notes.md, "Speed").
   */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

interface EmbedResponse {
  model?: string;
  embeddings?: unknown;
}

export class OllamaEmbedder implements Embedder {
  private readonly baseUrl: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: OllamaEmbedderOptions) {
    this.baseUrl = options.baseUrl;
    this.endpoint = new URL('/api/embed', options.baseUrl).href;
    this.model = options.model;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async embed(texts: string[], kind: EmbedKind): Promise<EmbedResult> {
    // /api/embed answers HTTP 200 with zero vectors for "" or [] (measured,
    // layer3-embeddings-notes.md), so blanks never go over the wire.
    const input = texts
      .filter((text) => text.trim() !== '')
      .map((text) => (kind === 'query' ? `${REQUIREMENT_QUERY_INSTRUCTION}${text}` : text));
    if (input.length === 0) {
      return { vectors: [], model: this.model, dimensions: 0 };
    }

    const body = await this.post(input);
    const vectors = body.embeddings;
    if (!Array.isArray(vectors)) {
      throw new EmbedderError('Ollama /api/embed answered with no embeddings array');
    }
    if (vectors.length !== input.length) {
      throw new EmbedderError(
        `Ollama /api/embed returned ${vectors.length} vectors for ${input.length} inputs`,
      );
    }
    if (!vectors.every(isNumberArray)) {
      throw new EmbedderError('Ollama /api/embed returned an element that is not an array of numbers');
    }
    const dimensions = vectors[0]!.length;
    if (dimensions === 0) {
      throw new EmbedderError('Ollama /api/embed returned an empty vector');
    }
    if (vectors.some((vector) => vector.length !== dimensions)) {
      throw new EmbedderError('Ollama /api/embed returned vectors of different lengths');
    }
    return { vectors, model: this.model, dimensions };
  }

  private async post(input: string[]): Promise<EmbedResponse> {
    // AbortSignal.timeout(ms) aborts with a DOMException named "TimeoutError"
    // and covers reading the body too. Types:
    // node_modules/@types/node/web-globals/abortcontroller.d.ts (the
    // `timeout(milliseconds)` member); behaviour from memory of
    // https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay.
    const signal = AbortSignal.timeout(this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // truncate: false makes an oversized input an HTTP 400 instead of a
        // silently cut one (the default is true). Docs: EmbedRequest.truncate.
        body: JSON.stringify({ model: this.model, input, truncate: false }),
        signal,
      });
    } catch (cause) {
      if (isTimeout(cause)) throw this.timeoutError(cause);
      throw new EmbedderError(
        `Could not reach the embedding service at ${this.baseUrl}: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    }

    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      if (isTimeout(cause)) throw this.timeoutError(cause);
      throw new EmbedderError('Ollama /api/embed ended before the whole answer arrived', { cause });
    }
    if (!response.ok) {
      throw new EmbedderError(
        `Ollama /api/embed answered HTTP ${response.status}: ${text.slice(0, 500)}`,
      );
    }
    try {
      return JSON.parse(text) as EmbedResponse;
    } catch (cause) {
      throw new EmbedderError('Ollama /api/embed answered with a body that is not valid JSON', { cause });
    }
  }

  private timeoutError(cause: unknown): EmbedderError {
    return new EmbedderError(
      `The embedding service at ${this.baseUrl} timed out after ${this.timeoutMs} ms`,
      { cause },
    );
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number');
}
