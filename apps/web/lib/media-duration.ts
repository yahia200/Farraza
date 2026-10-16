/**
 * Reads how long a video or audio file is, in seconds, from the file's own metadata. Browser only.
 *
 * The file is given to an element that is never put on the page, through an object URL, and we wait
 * for `loadedmetadata`; the browser then knows `duration` without playing or decoding the file
 * (https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadedmetadata_event,
 * https://developer.mozilla.org/docs/Web/API/URL/createObjectURL_static).
 *
 * `duration` is `NaN` before metadata and `Infinity` when the media has no known length
 * (https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/duration). Files recorded in the
 * browser (a WebM from `MediaRecorder`) have been reported to carry no length in their header, so
 * they report `Infinity`; the usual workaround is to seek far past the end so the browser scans to
 * the real end and fires `durationchange` with the true length. That workaround is from memory,
 * not from the MDN pages above, and it was NOT exercised: the Chrome used for the manual check
 * (2026-10) already reported a finite length for `MediaRecorder` WebM files, video and audio.
 *
 * Resolves to null when the length cannot be read: the file is not playable here (an unsupported
 * codec, such as HEVC in a MOV on a browser without it), it is not media at all, the read is
 * aborted, or it takes longer than `READ_TIMEOUT_MS`. The caller decides what null means.
 */

const READ_TIMEOUT_MS = 15_000;

/** Seeking to this makes the browser find the real end of a file whose header has no length. */
const FAR_PAST_THE_END = 1e101;

export function readMediaDuration(
  file: Blob,
  element: 'audio' | 'video',
  signal?: AbortSignal,
): Promise<number | null> {
  return new Promise((resolve) => {
    const media = document.createElement(element);
    const url = URL.createObjectURL(file);
    let finished = false;

    const finish = (seconds: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      // Detach the file so the browser lets go of it, then free the URL.
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), READ_TIMEOUT_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) return finish(null);

    media.preload = 'metadata';
    media.onerror = () => finish(null);
    media.onloadedmetadata = () => {
      if (Number.isFinite(media.duration)) {
        finish(media.duration);
        return;
      }
      // Infinity (or NaN): wait for the length the seek uncovers.
      media.ondurationchange = () => {
        if (Number.isFinite(media.duration)) finish(media.duration);
      };
      media.currentTime = FAR_PAST_THE_END;
    };
    media.src = url;
  });
}
