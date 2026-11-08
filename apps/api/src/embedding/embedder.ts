/*
 * The one seam through which Layer 3 (embedding match) reaches an embedding
 * model. Shaped by what the caller needs, not by any provider's request, so a
 * later OpenAI implementation is a new class (ADR-0008:
 * docs/adr/0008-embeddings-behind-an-embedder-interface-and-stored-as-real-arrays.md).
 */

/**
 * What the text is for. A `query` is a Requirement's sentence, a `document` is a
 * chunk of CV text. Some models want the two embedded differently.
 */
export type EmbedKind = 'query' | 'document';

export interface EmbedResult {
  /** One vector per input text, in the same order. */
  vectors: number[][];
  /** The model that produced the vectors, stored beside them. */
  model: string;
  /** Length of every vector, stored beside them. */
  dimensions: number;
}

export interface Embedder {
  /**
   * Embeds every text. The result always has exactly one vector per input; an
   * implementation that cannot guarantee that throws instead of returning fewer.
   * Throws an `EmbedderError` when the service is unreachable or answers badly.
   */
  embed(texts: string[], kind: EmbedKind): Promise<EmbedResult>;
}

/**
 * Injection token for the configured `Embedder`, or `null` when Layer 3 is off
 * (`EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` unset). Inject it with
 * `@Inject(EMBEDDER) embedder: Embedder | null`.
 */
export const EMBEDDER = Symbol('EMBEDDER');

/** Any failure reaching or reading the embedding service. The message is for logs. */
export class EmbedderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EmbedderError';
  }
}
