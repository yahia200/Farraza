'use client';

import { FileWarningIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PreviewKind } from '@repo/shared';
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

/**
 * The viewers fill the file preview page (app/(viewer)/…): the viewport minus the slim header
 * (3.5rem) and the page padding (2rem). `dvh` follows a phone's collapsing address bar.
 */
const VIEWER_HEIGHT = 'h-[calc(100dvh-5.5rem)] min-h-80';
const VIEWER_MAX_HEIGHT = 'max-h-[calc(100dvh-5.5rem)]';

type ViewerState =
  { status: 'loading' } | { status: 'ready'; url: string } | { status: 'failed'; message: string };

/**
 * Asks the API for an inline link once, when the viewer mounts. A new link on every visit to the
 * preview page: links last minutes, and they must never be cached or rendered into the page (the DAL
 * is cached, and so is the page's shell).
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

/**
 * Picks the viewer for a file's preview kind (`previewKindOf` in @repo/shared). To teach the preview
 * page a new kind, extend `previewKindOf` and add a case here and a viewer below. A null kind is a
 * type that can only be downloaded (someone opened the page's address by hand).
 */
export function FileViewer({ kind, file }: { kind: PreviewKind | null; file: ViewerFile }) {
  switch (kind) {
    case 'pdf':
      return <PdfViewer file={file} />;
    case 'docx':
      return <DocxViewer file={file} />;
    case 'image':
      return <ImageViewer file={file} />;
    case 'video':
    case 'audio':
      return <MediaViewer file={file} kind={kind} />;
    default:
      return <ViewerFailure message="This type of file can't be previewed." />;
  }
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
 * `sandbox` here on purpose: Chrome's PDF viewer refuses to run in a sandboxed frame. `FileCard`
 * only links to the preview page where `usePdfPreviewSupported()` is true; the page itself doesn't
 * check again (that hook is false until hydrated, which would flash a wrong message). `referrerPolicy="no-referrer"` keeps
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
    <video {...player} playsInline className={`${VIEWER_MAX_HEIGHT} w-full rounded-xl border bg-black`} />
  ) : (
    <audio {...player} className="w-full" />
  );
}

// --- Images (ticket 08) ------------------------------------------------------------------------

/**
 * An image attachment shown in place, straight from the bucket with an `<img>`.
 *
 * Why this is safe and needs nothing else: the link answers with the stored image type pinned and an
 * inline disposition (see StorageService.createViewUrl; SVG is never a stored type), and an `<img>`
 * never runs script, even from a file that lied about being an image. A cross-origin `<img>` needs
 * no CORS headers (unlike the DOCX `fetch`). `referrerPolicy="no-referrer"` keeps the dashboard
 * address (company, job and application ids) out of the bucket's logs. The picture is scaled to fit
 * the page (the original is a Download away); a failure to load falls back to the same alert as the
 * other viewers.
 * https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/img#referrerpolicy
 */
export function ImageViewer({ file }: { file: ViewerFile }) {
  const view = useViewUrl(file);
  const [image, setImage] = useState<'loading' | 'loaded' | 'failed'>('loading');

  if (view.status === 'failed') return <ViewerFailure message={view.message} />;
  if (image === 'failed') return <ViewerFailure message="This image couldn't be displayed." />;
  return (
    <div aria-busy={image === 'loading'}>
      {(view.status === 'loading' || image === 'loading') && (
        <div className="relative h-48 w-full">
          <Skeleton className="absolute inset-0 rounded-xl" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Opening the image…
          </div>
        </div>
      )}
      {view.status === 'ready' && (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived presigned URL on another origin: next/image can't optimise it
        <img
          src={view.url}
          alt={file.fileName}
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setImage('loaded')}
          onError={() => setImage('failed')}
          className={
            image === 'loaded' ? `mx-auto ${VIEWER_MAX_HEIGHT} max-w-full rounded-xl border object-contain` : 'hidden'
          }
        />
      )}
    </div>
  );
}
