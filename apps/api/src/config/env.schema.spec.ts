import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

// A complete, valid environment, shaped like process.env (every value a string).
const valid = (): Record<string, string> => ({
  PORT: '3001',
  DATABASE_URL: 'postgresql://hiring:hiring@localhost:5432/hiring',
  APP_URL: 'http://localhost:3000',
  INTERNAL_API_SECRET: 'a-long-random-dev-secret',
  S3_BUCKET: 'khatwateen-dev',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'rustfsadmin',
  S3_SECRET_KEY: 'rustfsadmin',
  GOOGLE_CLIENT_ID: 'dev-client-id',
  GOOGLE_CLIENT_SECRET: 'dev-client-secret',
});

describe('validateEnv', () => {
  it('accepts a valid environment, coercing PORT and keeping unrelated variables', () => {
    const env = validateEnv({
      ...valid(),
      PATH: '/usr/bin',
      NODE_ENV: 'development',
    });

    expect(env.PORT).toBe(3001);
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.PATH).toBe('/usr/bin');
    expect(env.NODE_ENV).toBe('development');
  });

  it('names every missing variable in one error', () => {
    const { DATABASE_URL: _db, S3_BUCKET: _bucket, ...rest } = valid();

    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL[\s\S]*S3_BUCKET/);
  });

  it('lets optional variables be omitted, defaulting the mail sender', () => {
    const env = validateEnv(valid());

    expect(env.S3_FORCE_PATH_STYLE).toBeUndefined();
    expect(env.SMTP_URL).toBeUndefined();
    expect(env.MAIL_FROM).toBe('Khatwateen <accounts@khatwateen.app>');
  });

  it('refuses to boot in production without SMTP_URL, naming it', () => {
    expect(() => validateEnv({ ...valid(), NODE_ENV: 'production' })).toThrow(
      /SMTP_URL/,
    );
  });

  it('boots in production when SMTP_URL is set', () => {
    const env = validateEnv({
      ...valid(),
      NODE_ENV: 'production',
      SMTP_URL: 'smtp://user:pass@smtp.example.com:587',
    });

    expect(env.SMTP_URL).toBe('smtp://user:pass@smtp.example.com:587');
  });

  it('refuses an S3_FORCE_PATH_STYLE other than "true" or "false"', () => {
    expect(() =>
      validateEnv({ ...valid(), S3_FORCE_PATH_STYLE: 'yes' }),
    ).toThrow(/S3_FORCE_PATH_STYLE/);
  });

  it('names every malformed variable', () => {
    const env = {
      ...valid(),
      APP_URL: 'localhost:3000 no scheme',
      PORT: 'abc',
      INTERNAL_API_SECRET: 'short',
    };

    let message = '';
    try {
      validateEnv(env);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^Invalid environment variables:/);
    expect(message).toContain('APP_URL');
    expect(message).toContain('PORT');
    expect(message).toContain('INTERNAL_API_SECRET');
  });
});
