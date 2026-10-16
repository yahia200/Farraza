/**
 * The names recruiters know for the types applicants can send (the kind-to-format mapping in
 * .scratch/file-uploads/spec.md). Anything else shows its raw type rather than a guess.
 */
const TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
  'video/mp4': 'MP4 video',
  'video/quicktime': 'MOV video',
  'video/webm': 'WebM video',
  'audio/mpeg': 'MP3 audio',
  'audio/mp4': 'M4A audio',
  'audio/x-m4a': 'M4A audio',
  'audio/wav': 'WAV audio',
  'audio/x-wav': 'WAV audio',
  'audio/ogg': 'OGG audio',
  'audio/webm': 'WebM audio',
};

export function fileTypeLabel(mimeType: string): string {
  return TYPE_LABELS[mimeType.toLowerCase()] ?? mimeType;
}

/** "0:42", "12:05", "1:02:03": the length of a video or audio file. */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
