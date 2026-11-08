import { describe, expect, it } from 'vitest';
import { EmbedderError } from './embedder.js';
import { OllamaEmbedder, REQUIREMENT_QUERY_INSTRUCTION } from './ollama-embedder.js';

interface Call {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
}

// A hand-written fake `fetch`: records each call and answers with `respond`.
function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      init: init ?? {},
      body: JSON.parse(String(init?.body ?? 'null')) as Record<string, unknown>,
    };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetchImpl: fetchImpl as typeof fetch };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Answers with one 3-number vector per input string, like /api/embed does.
const echoVectors = (call: Call) =>
  json({
    model: call.body.model,
    embeddings: (call.body.input as string[]).map((_, i) => [i, i + 0.5, i + 1]),
  });

describe('OllamaEmbedder', () => {
  it('posts the texts to /api/embed with truncate false and returns the vectors', async () => {
    const { calls, fetchImpl } = fakeFetch(echoVectors);
    const embedder = new OllamaEmbedder({
      baseUrl: 'http://ollama.test:11434',
      model: 'qwen3-embedding:0.6b',
      fetch: fetchImpl,
    });

    const result = await embedder.embed(['first', 'second'], 'document');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://ollama.test:11434/api/embed');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.body).toEqual({
      model: 'qwen3-embedding:0.6b',
      input: ['first', 'second'],
      truncate: false,
    });
    expect(result).toEqual({
      vectors: [
        [0, 0.5, 1],
        [1, 1.5, 2],
      ],
      model: 'qwen3-embedding:0.6b',
      dimensions: 3,
    });
  });

  describe('the query instruction', () => {
    const make = (fetchImpl: typeof fetch) =>
      new OllamaEmbedder({
        baseUrl: 'http://ollama.test:11434',
        model: 'm',
        fetch: fetchImpl,
      });

    it('prefixes every input of kind query', async () => {
      const { calls, fetchImpl } = fakeFetch(echoVectors);

      await make(fetchImpl).embed(['Experience with PostgreSQL', 'Leads a team'], 'query');

      expect(calls[0]!.body.input).toEqual([
        `${REQUIREMENT_QUERY_INSTRUCTION}Experience with PostgreSQL`,
        `${REQUIREMENT_QUERY_INSTRUCTION}Leads a team`,
      ]);
    });

    it('leaves inputs of kind document untouched', async () => {
      const { calls, fetchImpl } = fakeFetch(echoVectors);

      await make(fetchImpl).embed(['Built APIs in Node'], 'document');

      expect(calls[0]!.body.input).toEqual(['Built APIs in Node']);
    });

    it('is the instruction wording agreed in the spec, ending in "Query:"', () => {
      expect(REQUIREMENT_QUERY_INSTRUCTION).toBe(
        'Instruct: Given a job requirement, retrieve resume passages that satisfy it\nQuery:',
      );
    });
  });

  describe('failures', () => {
    const make = (fetchImpl: typeof fetch) =>
      new OllamaEmbedder({ baseUrl: 'http://ollama.test:11434', model: 'qwen3-embedding:0.6b', fetch: fetchImpl });

    it('names the host when it cannot be reached', async () => {
      const { fetchImpl } = fakeFetch(() => {
        throw new TypeError('fetch failed');
      });

      const failure = make(fetchImpl).embed(['x'], 'document');

      await expect(failure).rejects.toThrow(EmbedderError);
      await expect(failure).rejects.toThrow(
        /Could not reach the embedding service at http:\/\/ollama\.test:11434.*fetch failed/,
      );
    });

    it('reports a non-OK status with the status and the body Ollama sent', async () => {
      const { fetchImpl } = fakeFetch(() =>
        json({ error: 'the input length exceeds the context length' }, 400),
      );

      const failure = make(fetchImpl).embed(['x'], 'document');

      await expect(failure).rejects.toThrow(EmbedderError);
      await expect(failure).rejects.toThrow(
        /HTTP 400.*the input length exceeds the context length/,
      );
    });

    it('rejects a vector count that differs from the number of inputs', async () => {
      const { fetchImpl } = fakeFetch(() =>
        json({ model: 'qwen3-embedding:0.6b', embeddings: [[1, 2, 3]] }),
      );

      const failure = make(fetchImpl).embed(['a', 'b'], 'document');

      await expect(failure).rejects.toThrow(EmbedderError);
      await expect(failure).rejects.toThrow(/returned 1 vectors for 2 inputs/);
    });

    it('rejects an answer that is not JSON with an embeddings array', async () => {
      const notJson = fakeFetch(() => new Response('<html>proxy error</html>', { status: 200 }));
      const noEmbeddings = fakeFetch(() => json({ model: 'm' }));

      await expect(make(notJson.fetchImpl).embed(['a'], 'document')).rejects.toThrow(
        /not valid JSON/,
      );
      await expect(make(noEmbeddings.fetchImpl).embed(['a'], 'document')).rejects.toThrow(
        /no embeddings array/,
      );
    });

    it('gives up on a host that never answers, as an EmbedderError naming the time limit', async () => {
      // Hangs until the request's AbortSignal fires, like a real fetch does.
      const { fetchImpl } = fakeFetch(
        (call) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = call.init.signal;
            if (!signal) return; // no signal passed: hangs forever, the test times out
            signal.addEventListener('abort', () => reject(signal.reason));
          }),
      );
      const embedder = new OllamaEmbedder({
        baseUrl: 'http://ollama.test:11434',
        model: 'm',
        fetch: fetchImpl,
        timeoutMs: 20,
      });

      const failure = embedder.embed(['x'], 'document');

      await expect(failure).rejects.toThrow(EmbedderError);
      await expect(failure).rejects.toThrow(/timed out after 20 ms/);
    });

    it.each([
      ['an element that is not an array', [null]],
      ['an element that is a string', ['0.1,0.2']],
      ['a vector holding a non-number', [[0.1, 'x', 0.3]]],
      ['an empty vector', [[]]],
    ])('rejects %s as malformed, not as a TypeError', async (_name, embeddings) => {
      const { fetchImpl } = fakeFetch(() => json({ embeddings }));

      const failure = make(fetchImpl).embed(['a'], 'document');

      await expect(failure).rejects.toThrow(EmbedderError);
      await expect(failure).rejects.toThrow(/not an array of numbers|empty vector/);
    });

    it('rejects vectors of differing lengths', async () => {
      const { fetchImpl } = fakeFetch(() => json({ embeddings: [[1, 2, 3], [1, 2]] }));

      await expect(make(fetchImpl).embed(['a', 'b'], 'document')).rejects.toThrow(
        /vectors of different lengths/,
      );
    });
  });

  describe('blank texts', () => {
    it('are not sent, and the vectors line up with the texts that were', async () => {
      const { calls, fetchImpl } = fakeFetch(echoVectors);
      const embedder = new OllamaEmbedder({ baseUrl: 'http://o.test', model: 'm', fetch: fetchImpl });

      const result = await embedder.embed(['alpha', '', '   \n', 'gamma'], 'document');

      expect(calls[0]!.body.input).toEqual(['alpha', 'gamma']);
      expect(result.vectors).toHaveLength(2);
    });

    it('make no request at all when nothing is left to embed', async () => {
      const { calls, fetchImpl } = fakeFetch(echoVectors);
      const embedder = new OllamaEmbedder({ baseUrl: 'http://o.test', model: 'm', fetch: fetchImpl });

      const result = await embedder.embed(['', ' '], 'document');
      const none = await embedder.embed([], 'query');

      expect(calls).toHaveLength(0);
      expect(result).toEqual({ vectors: [], model: 'm', dimensions: 0 });
      expect(none.vectors).toEqual([]);
    });
  });
});
