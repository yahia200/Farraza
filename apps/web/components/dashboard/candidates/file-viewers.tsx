'use client';

import { FileWarningIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getFileViewUrl } from '@/app/actions/applications';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { DOCX_PREVIEW_MAX_BYTES, renderDocxToSrcdoc } from './docx-render';

/** Which file to show; the viewers mint their own short-lived link when they open. */
export interface ViewerFile {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  fileId: string;
  fileName: string;
  sizeBytes: number;
}

const VIEWER_HEIGHT = 'h-[70vh] min-h-80';

type ViewerState =
  { status: 'loading' } | { status: 'ready'; url: string } | { status: 'failed'; message: string };

/**
 * Asks the API for an inline link once, when the viewer mounts. A new link on every open (the card
 * unmounts the viewer when it closes): links last minutes, and they must never be cached or rendered
 * into the page (the DAL and the sheet are cached).
 */
function useViewUrl(file: ViewerFile) {
  const { companySlug, jobSlug, applicationId, fileId } = file;
  const [state, setState] = useState<ViewerState>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    getFileViewUrl(companySlug, jobSlug, applicationId, fileId).then(
      (result) => {
        if (!current) return;
        setState(
          result.url
            ? { status: 'ready', url: result.url }
            : {
                status: 'failed',
                message: result.formError ?? "Couldn't open the file.",
              },
        );
      },
      () => {
        if (current)
          setState({
            status: 'failed',
            message: 'Check your connection and try again.',
          });
      },
    );
    return () => {
      current = false;
    };
  }, [companySlug, jobSlug, applicationId, fileId]);

  return state;
}

function ViewerFailure({ message }: { message: string }) {
  return (
    <Alert>
      <FileWarningIcon />
      <AlertTitle>Can&apos;t show this file here</AlertTitle>
      <AlertDescription>{message} Use Download to read it.</AlertDescription>
    </Alert>
  );
}

function ViewerLoading({ label }: { label: string }) {
  return (
    <div className={`relative ${VIEWER_HEIGHT} w-full`} aria-busy="true">
      <Skeleton className="absolute inset-0 rounded-xl" />
      <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        {label}
      </div>
    </div>
  );
}

/**
 * A PDF in the browser's own viewer, in an iframe on the bucket's origin.
 *
 * The link answers `Content-Type: application/pdf` and `Content-Disposition: inline` (both signed,
 * see StorageService.createViewUrl), so the browser opens its PDF viewer rather than saving it, and
 * the bytes sit on another origin than the dashboard: a PDF can't reach our cookies or pages. No
 * `sandbox` here on purpose: Chrome's PDF viewer refuses to run in a sandboxed frame. The caller
 * only renders this where `usePdfPreviewSupported()` is true. `referrerPolicy="no-referrer"` keeps
 * the dashboard address (company, job and application ids) out of the bucket's logs.
 * https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/iframe#referrerpolicy
 */
export function PdfViewer({ file }: { file: ViewerFile }) {
  const view = useViewUrl(file);

  if (view.status === 'failed') return <ViewerFailure message={view.message} />;
  if (view.status === 'loading') return <ViewerLoading label="Opening the PDF…" />;
  return (
    <iframe
      src={view.url}
      title={`Preview of ${file.fileName}`}
      referrerPolicy="no-referrer"
      className={`${VIEWER_HEIGHT} w-full rounded-xl border bg-white`}
    />
  );
}

type DocxState =
  { status: 'loading' } | { status: 'ready'; srcDoc: string } | { status: 'failed'; message: string };

/**
 * A DOCX rendered in the browser with `docx-preview`; the bytes never leave the recruiter's machine
 * and no third-party service sees them.
 *
 * Flow: link from the Server Action, then this component fetches the bytes straight from the bucket
 * (a CORS GET: the bucket's rules allow the web app's origin, docs/db-schema.md section 9), the
 * library renders them to an HTML string (`docx-render.ts`, nothing attached to this page), and the
 * string becomes the `srcDoc` of an iframe with `sandbox=""`: no scripts, no forms, no popups, no
 * top navigation, and no same-origin, so the document gets an opaque origin and could not read the
 * dashboard even if some markup slipped through. Never add `allow-scripts` or `allow-same-origin`.
 */
export function DocxViewer({ file }: { file: ViewerFile }) {
  const view = useViewUrl(file);
  const [rendered, setRendered] = useState<DocxState>({ status: 'loading' });
  const url = view.status === 'ready' ? view.url : null;

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    (async () => {
      try {
        // Checked twice: the size the API recorded, and what actually arrives.
        if (file.sizeBytes > DOCX_PREVIEW_MAX_BYTES) throw new TooLarge();
        const response = await fetch(url, {
          signal: abort.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > DOCX_PREVIEW_MAX_BYTES) throw new TooLarge();
        const srcDoc = await renderDocxToSrcdoc(bytes);
        if (!abort.signal.aborted) setRendered({ status: 'ready', srcDoc });
      } catch (error) {
        if (abort.signal.aborted) return;
        setRendered({
          status: 'failed',
          message:
            error instanceof TooLarge
              ? 'This document is too large to preview.'
              : "This document couldn't be displayed.",
        });
      }
    })();
    return () => abort.abort();
  }, [url, file.sizeBytes]);

  if (view.status === 'failed') return <ViewerFailure message={view.message} />;
  if (rendered.status === 'failed') return <ViewerFailure message={rendered.message} />;
  if (rendered.status === 'loading') return <ViewerLoading label="Opening the document…" />;
  return (
    <iframe
      sandbox=""
      srcDoc={rendered.srcDoc}
      title={`Preview of ${file.fileName}`}
      referrerPolicy="no-referrer"
      className={`${VIEWER_HEIGHT} w-full rounded-xl border bg-white`}
    />
  );
}

class TooLarge extends Error {}

/**
 * A video or audio file in the browser's own player (`<video controls>` / `<audio controls>`), fed
 * the inline link from the Server Action. `preload="metadata"` fetches only the start (enough for
 * the length and first frame); the bucket answers range requests, so seeking works without
 * downloading the whole file (https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/video).
 *
 * `<video>` and `<audio>` have no `referrerpolicy` attribute, unlike the iframe above, so the
 * request carries the browser's default policy (`strict-origin-when-cross-origin`): the dashboard's
 * origin, never its path with the company, job and application ids. The link's pinned `Content-Type`
 * and inline disposition come from `StorageService.createViewUrl`, and the type is one of the
 * stored video or audio types, never a page, so nothing here can run script.
 *
 * Not every browser plays every accepted format (a MOV holding HEVC, say): the player's `error`
 * event shows the same fallback as the other viewers, which points at Download.
 */
export function MediaViewer({ file, kind }: { file: ViewerFile; kind: 'video' | 'audio' }) {
  const view = useViewUrl(file);
  const [unplayable, setUnplayable] = useState(false);

  if (view.status === 'failed') return <ViewerFailure message={view.message} />;
  if (unplayable) return <ViewerFailure message="Your browser can't play this file." />;
  if (view.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
        <Spinner />
        Opening the {kind}…
      </div>
    );
  }

  const player = {
    src: view.url,
    controls: true,
    preload: 'metadata' as const,
    'aria-label': `Player for ${file.fileName}`,
    onError: () => setUnplayable(true),
  };
  return kind === 'video' ? (
    <video {...player} playsInline className="max-h-[70vh] w-full rounded-xl border bg-black" />
  ) : (
    <audio {...player} className="w-full" />
  );
}
