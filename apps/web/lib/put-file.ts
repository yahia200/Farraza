/**
 * Sends a file's bytes straight to a presigned URL (the bucket), reporting progress.
 *
 * XMLHttpRequest rather than `fetch`: fetch has no upload progress events yet,
 * while `xhr.upload.onprogress` does (https://developer.mozilla.org/docs/Web/API/XMLHttpRequestUpload).
 * The URL signs the content type and length (apps/api/src/storage/storage.service.ts), so
 * the Content-Type header must be the one the API returned; the browser sets Content-Length itself.
 * Runs in the browser only.
 */
export function putFile({
  url,
  file,
  contentType,
  onProgress,
  signal,
}: {
  url: string;
  file: Blob;
  contentType: string;
  /** Percent sent, 0 to 100. */
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const done = () => signal.removeEventListener('abort', abort);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      done();
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`The upload was refused (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => {
      done();
      reject(new Error('The upload could not reach the server.'));
    };
    request.onabort = () => {
      done();
      reject(new DOMException('The upload was cancelled.', 'AbortError'));
    };

    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);
    request.send(file);
  });
}
