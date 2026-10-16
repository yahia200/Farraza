import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { attachmentDisposition, DOWNLOAD_URL_TTL_SECONDS } from './storage.js';
import { StorageService } from './storage.service.js';

// RFC 6266 section 4.1 and 4.3 (https://www.rfc-editor.org/rfc/rfc6266): `filename` is a quoted
// ASCII fallback, `filename*` carries the real name as RFC 8187 ext-value (UTF-8, percent-encoded,
// https://www.rfc-editor.org/rfc/rfc8187#section-3.2.1).
describe('attachmentDisposition', () => {
  it('forces a download and keeps a plain ASCII name as it is', () => {
    expect(attachmentDisposition('cv.pdf')).toBe(
      `attachment; filename="cv.pdf"; filename*=UTF-8''cv.pdf`,
    );
  });

  it('percent-encodes spaces and non-ASCII letters in filename* and falls back to underscores', () => {
    expect(attachmentDisposition('Mona Élie – CV.pdf')).toBe(
      `attachment; filename="Mona _lie _ CV.pdf"; filename*=UTF-8''Mona%20%C3%89lie%20%E2%80%93%20CV.pdf`,
    );
  });

  it('encodes the characters RFC 8187 does not allow literally: * \' ( ) and %', () => {
    expect(attachmentDisposition(`a*b'c(d)e%f.pdf`)).toBe(
      `attachment; filename="a*b'c(d)e_f.pdf"; filename*=UTF-8''a%2Ab%27c%28d%29e%25f.pdf`,
    );
  });

  it('cannot break out of the quoted string', () => {
    const header = attachmentDisposition('x".pdf"; filename="evil.exe');
    expect(header.startsWith('attachment; filename="x_.pdf_; filename=_evil.exe"; ')).toBe(true);
    expect(header).not.toContain('\\');
  });

  it('strips control characters, so a name cannot inject a header line', () => {
    const header = attachmentDisposition('a\r\nSet-Cookie: x=1\u0000.pdf');
    expect(header).not.toMatch(/\p{Cc}/u);
    expect(header).toContain(`filename*=UTF-8''aSet-Cookie%3A%20x%3D1.pdf`);
  });

  it('keeps only the last path segment', () => {
    expect(attachmentDisposition('..\\..\\etc/passwd')).toBe(
      `attachment; filename="passwd"; filename*=UTF-8''passwd`,
    );
  });

  it('survives an emoji and a lone surrogate without throwing', () => {
    expect(attachmentDisposition('cv 😀.pdf')).toContain(`filename*=UTF-8''cv%20%F0%9F%98%80.pdf`);
    expect(attachmentDisposition('bad\uD800.pdf')).toContain(`%EF%BF%BD.pdf`);
  });

  it.each(['  \r\n ', '..', '.', 'folder/'])(
    'falls back to a generic name when nothing usable is left (%j)',
    (name) => {
      expect(attachmentDisposition(name)).toBe(`attachment; filename="file"; filename*=UTF-8''file`);
    },
  );
});

// Signing is offline (no request leaves the process), so the real StorageService can run here.
describe('StorageService.createDownloadUrl', () => {
  const config = new ConfigService({
    S3_BUCKET: 'test-bucket',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'test-access-key',
    S3_SECRET_KEY: 'test-secret-key',
  });

  it('signs an attachment disposition with the original file name and the download TTL', async () => {
    const storage = new StorageService(config);

    const url = new URL(await storage.createDownloadUrl('companies/c/jobs/j/files/f', 'Mona CV.pdf'));

    expect(url.pathname).toBe('/test-bucket/companies/c/jobs/j/files/f');
    expect(url.searchParams.get('response-content-disposition')).toBe(
      attachmentDisposition('Mona CV.pdf'),
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe(String(DOWNLOAD_URL_TTL_SECONDS));
    // The override is signed, so changing it on the way invalidates the URL.
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });
});
