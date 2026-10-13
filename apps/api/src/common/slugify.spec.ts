import { describe, expect, it } from 'vitest';
import { slugify } from './slugify.js';

// The CHECK constraints from src/prisma/contract.prisma. A slug that fails
// these makes the insert fail with SQLSTATE 23514 (a 500 to the client).
const COMPANY_SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const JOB_SLUG = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

const company = (name: string) => slugify(name, 30, 'company');
const job = (title: string) => slugify(title, 60, 'job');

describe('slugify', () => {
  it('lowercases and joins words with "-"', () => {
    expect(company('Acme Inc.')).toBe('acme-inc');
  });

  it('pads names too short for the constraint with the fallback word', () => {
    expect(company('HP')).toBe('hp-company');
    expect(company('A!')).toBe('a-company');
    expect(job('QA')).toBe('qa-job');
  });

  it('uses the fallback when nothing usable is left', () => {
    expect(company('!!')).toBe('company');
    expect(company('خطوتين')).toBe('company');
  });

  it('never ends with "-" after cutting to the maximum length', () => {
    // 29 letters, a space, then more: the cut at 30 lands right after the "-".
    expect(company('abcdefghijklmnopqrstuvwxyzabc x')).toBe('abcdefghijklmnopqrstuvwxyzabc');
  });

  it.each(['AB', 'A!', '!!', 'Acme Inc.', 'abcdefghijklmnopqrstuvwxyzabc x', 'x'.repeat(200), '--a--'])(
    'produces a slug the database accepts for %j',
    (name) => {
      expect(company(name)).toMatch(COMPANY_SLUG);
      // The collision suffix ("-xxxx") must still fit.
      expect(`${company(name)}-abcd`).toMatch(COMPANY_SLUG);
      expect(job(name)).toMatch(JOB_SLUG);
      expect(`${job(name)}-abcd`).toMatch(JOB_SLUG);
    },
  );
});
