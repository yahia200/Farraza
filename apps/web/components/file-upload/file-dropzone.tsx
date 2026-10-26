'use client';

import { UploadIcon } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A drop target and file chooser in one, for one file or several. It only selects: it hands the
 * chosen `File`s to `onFiles` and sends nothing, so each screen keeps its own checks and upload
 * logic (the apply page's `UploadControl` is the example). Show the files with `FileUploadItem`.
 *
 * The whole zone is a `<label>` around a visually hidden `<input type="file">`, so a click opens
 * the chooser and the input is what keyboard users focus (Enter or Space). Dragging is an
 * addition on top: phones and keyboards use the input. A label may only hold phrasing content, so
 * `children` (which replace the default prompt) must be spans, not divs.
 *
 * Drops come from HTML drag and drop events
 * (https://developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop).
 * `accept` only steers the chooser: the user can still pick "All files" or drop anything, so a
 * consumer must check each file itself, as `UploadControl`'s `check` does.
 */
export function FileDropzone({
  className,
  accept,
  multiple = false,
  maxFiles,
  disabled = false,
  onFiles,
  onReject,
  title,
  description,
  children,
  'aria-describedby': describedBy,
}: {
  className?: string;
  /** The file input's `accept` attribute; it only steers the chooser (see above). */
  accept?: string;
  /** Several files in one drop or choice. Off, a drop of two or more is refused, never cut down to one. */
  multiple?: boolean;
  /**
   * How many files one drop or choice may add; a drop of more is refused as a whole. Not a running
   * total: to cap the total, pass how many places are left (0 refuses everything).
   */
  maxFiles?: number;
  /** Ignores drops and clicks. The zone stays a drop target so a missed drop doesn't open the file in the browser. */
  disabled?: boolean;
  /** The chosen files, at least one. Not called for a refused selection. */
  onFiles: (files: [File, ...File[]]) => void;
  /** Why a whole selection was refused (too many files), as a message ready to show. */
  onReject?: (message: string) => void;
  /** The prompt line; defaults to one that fits `multiple`. */
  title?: ReactNode;
  /** A hint under the prompt, such as the accepted types and size. */
  description?: ReactNode;
  /** Replaces the whole default content (icon, title, description). Phrasing content only. */
  children?: ReactNode;
  /** Forwarded to the file input, which is the control that takes focus. */
  'aria-describedby'?: string;
}) {
  const [dragging, setDragging] = useState(false);
  // dragenter and dragleave also fire for every child the pointer crosses; counting them keeps
  // the highlight from flickering. It is 0 when the pointer is outside.
  const depth = useRef(0);

  function receive(files: File[]) {
    const [first, ...rest] = files;
    if (disabled || !first) return;
    if (!multiple && files.length > 1) {
      onReject?.('Add one file at a time.');
      return;
    }
    if (maxFiles !== undefined && files.length > maxFiles) {
      onReject?.(
        maxFiles <= 0
          ? 'No more files can be added.'
          : `You can add up to ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'} at a time.`,
      );
      return;
    }
    onFiles([first, ...rest]);
  }

  /** Only drags that carry files; dragging selected text across the zone does nothing. */
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  return (
    <label
      data-slot="file-dropzone"
      data-dragging={dragging && !disabled}
      data-disabled={disabled}
      className={cn(
        'group/dropzone flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/50',
        'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/30',
        'data-[dragging=true]:border-ring data-[dragging=true]:bg-muted',
        'data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[disabled=true]:hover:bg-transparent',
        className,
      )}
      onDragEnter={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        // Cancelling dragover is what makes the zone a valid drop target.
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      }}
      onDragLeave={(event) => {
        if (!carriesFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        // Without this the browser would navigate to the dropped file.
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        receive(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-describedby={describedBy}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Clearing the value lets the same file be chosen again after removing it.
          event.target.value = '';
          receive(files);
        }}
      />
      {children ?? (
        <>
          <span className="flex size-10 items-center justify-center text-foreground transition-colors group-data-[dragging=true]/dropzone:bg-background">
            <UploadIcon className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-medium">
            {title ?? (multiple ? 'Drag files here, or browse' : 'Drag a file here, or browse')}
          </span>
          {description && <span className="text-sm text-muted-foreground">{description}</span>}
        </>
      )}
    </label>
  );
}
