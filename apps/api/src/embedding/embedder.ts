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
  /** One vector per non-blank input text, in the same order (blank texts have no vector). */
  vectors: number[][];
  /** The model that produced the vectors, stored beside them. */
  model: string;
  /** Length of every vector, stored beside them. */
  dimensions: number;
}

export interface Embedder {
  /**
   * Embeds the texts. Blank texts (empty or whitespace only) are skipped: they
   * are never sent to the model and get no vector, so the result has exactly
   * one vector per non-blank input, in input order. Callers that need one
   * vector per text must pass non-blank texts only. An implementation that
   * cannot return a vector for every non-blank text throws instead of
   * returning fewer. With no non-blank text the result has no vectors.
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
