import { describe, expect, it } from 'vitest';
import { extractContactSuggestions } from './cv-contacts.js';
import type { FormField } from './form-fields.js';
import type { PresetKey } from './preset-keys.js';

// All CV text below is invented.

function question(presetKey: PresetKey | null, type: 'url' | 'short_text', config: object = {}): FormField {
  return {
    key: crypto.randomUUID(),
    type,
    label: 'Any label at all',
    helpText: null,
    required: false,
    presetKey,
    config: type === 'short_text' ? { maxLength: 100, ...config } : {},
  } as FormField;
}

const linkedin = question('contact.linkedin_url', 'url');
const github = question('contact.github_url', 'url');
const portfolio = question('contact.portfolio_url', 'url');
const location = question('contact.location', 'short_text');
const form = [linkedin, github, portfolio, location];

function answerFor(result: ReturnType<typeof extractContactSuggestions>, field: FormField) {
  return result.answers[field.key];
}

const CV = `Sara Hassan
Cairo, Egypt | sara.hassan@example.com | +20 100 123 4567
linkedin.com/in/sara-hassan | github.com/sarah-codes | https://sara.dev

Summary
Backend engineer.
`;

describe('extractContactSuggestions: name, email, phone', () => {
  it('finds each from invented CV text', () => {
    const result = extractContactSuggestions(CV, []);
    expect(result.name).toBe('Sara Hassan');
    expect(result.email).toBe('sara.hassan@example.com');
    expect(result.phone).toBe('+201001234567');
  });

  it('suggests nothing for values the text does not have', () => {
    const result = extractContactSuggestions('Experience\nWorked at a bank for years.', form);
    expect(result).toEqual({ answers: {} });
  });

  it('skips blank lines and takes the first plausible line as the name', () => {
    expect(extractContactSuggestions('\n\n  Omar  Khaled  \nCairo', []).name).toBe('Omar Khaled');
  });

  it('does not take a heading, an email line or a line with digits as the name', () => {
    expect(extractContactSuggestions('Curriculum Vitae\nLaila Nabil\n', []).name).toBe('Laila Nabil');
    expect(extractContactSuggestions('RESUME\nlaila@example.com\n01001234567\nLaila Nabil', []).name).toBe('Laila Nabil');
  });

  it('accepts names in other scripts, hyphens and apostrophes', () => {
    expect(extractContactSuggestions('Ahmed Mohamed Ali', []).name).toBe('Ahmed Mohamed Ali');
    expect(extractContactSuggestions("Mary-Jane O'Neil", []).name).toBe("Mary-Jane O'Neil");
    expect(extractContactSuggestions('أحمد محمد', []).name).toBe('أحمد محمد');
  });

  it('gives no name for a one-word or sentence-like first lines', () => {
    expect(extractContactSuggestions('Resume', []).name).toBeUndefined();
    expect(
      extractContactSuggestions('I am a developer who loves building things for the web every day', []).name,
    ).toBeUndefined();
  });

  it('takes the first valid of several emails and lowercases it', () => {
    const result = extractContactSuggestions('Sara\nContact: Sara.H@Example.COM or other@example.org', []);
    expect(result.email).toBe('sara.h@example.com');
  });

  it('finds an email stuck to labels and separators', () => {
    expect(extractContactSuggestions('Email:sara@example.com|Cairo', []).email).toBe('sara@example.com');
    expect(extractContactSuggestions('mailto:sara@example.com.', []).email).toBe('sara@example.com');
  });

  it('normalises phones written several ways and skips year ranges', () => {
    const text = 'Sara Hassan\nCairo University 2015 - 2019\nMobile: 0100 123 4567';
    expect(extractContactSuggestions(text, []).phone).toBe('+201001234567');
    expect(extractContactSuggestions('Tel (0100) 123-4567', []).phone).toBe('+201001234567');
    expect(extractContactSuggestions('Call +44 20 7946 0958', []).phone).toBe('+442079460958');
  });

  it('offers no phone when the digits are not a valid number', () => {
    expect(extractContactSuggestions('Order 123456789012345678 shipped\n2015 - 2019', []).phone).toBeUndefined();
  });

  it('suggests nothing for empty text, with or without questions', () => {
    expect(extractContactSuggestions('', [])).toEqual({ answers: {} });
    expect(extractContactSuggestions('', form)).toEqual({ answers: {} });
    expect(extractContactSuggestions('  \n\n ', form)).toEqual({ answers: {} });
  });

  it('keeps a name of exactly 100 characters and drops one of 101', () => {
    // Four words and three spaces; the application form allows a name of 100 characters at most.
    const nameOfLength = (length: number) => {
      const letters = length - 3;
      const sizes = [0, 1, 2, 3].map((i) => Math.floor(letters / 4) + (i < letters % 4 ? 1 : 0));
      return sizes.map((size) => `B${'a'.repeat(size - 1)}`).join(' ');
    };
    expect(nameOfLength(100)).toHaveLength(100);
    expect(extractContactSuggestions(nameOfLength(100), []).name).toBe(nameOfLength(100));
    expect(nameOfLength(101)).toHaveLength(101);
    expect(extractContactSuggestions(nameOfLength(101), []).name).toBeUndefined();
  });
});

describe('extractContactSuggestions: links and location by Preset key', () => {
  const result = extractContactSuggestions(CV, form);

  it('finds LinkedIn, GitHub, a portfolio and a location', () => {
    expect(answerFor(result, linkedin)).toBe('https://www.linkedin.com/in/sara-hassan');
    expect(answerFor(result, github)).toBe('https://github.com/sarah-codes');
    expect(answerFor(result, portfolio)).toBe('https://sara.dev');
    expect(answerFor(result, location)).toBe('Cairo, Egypt');
  });

  it('cuts a GitHub repository link back to the profile and drops tracking noise', () => {
    const r = extractContactSuggestions('see https://github.com/sarah-codes/my-repo?tab=readme.', [github]);
    expect(answerFor(r, github)).toBe('https://github.com/sarah-codes');
  });

  it('takes the first of several candidates for one value', () => {
    const text = 'Sara Hassan\nlinkedin.com/in/first-one\nlinkedin.com/in/second-one\nhttps://one.dev https://two.dev';
    const r = extractContactSuggestions(text, [linkedin, portfolio]);
    expect(answerFor(r, linkedin)).toBe('https://www.linkedin.com/in/first-one');
    expect(answerFor(r, portfolio)).toBe('https://one.dev');
  });

  it('does not take social sites, email domains or technology names as a portfolio', () => {
    const text = 'sara@example.com\nlinkedin.com/in/sara\ngithub.com/sara\ntwitter.com/sara\nSkills: Node.js, Vue.js, ASP.NET';
    expect(answerFor(extractContactSuggestions(text, [portfolio]), portfolio)).toBeUndefined();
  });

  it('counts a github.io page as a portfolio', () => {
    const r = extractContactSuggestions('https://sara.github.io/site', [portfolio, github]);
    expect(answerFor(r, portfolio)).toBe('https://sara.github.io/site');
    expect(answerFor(r, github)).toBeUndefined();
  });

  it('finds a labelled location, even a single word', () => {
    expect(answerFor(extractContactSuggestions('Sara Hassan\nLocation: Alexandria', [location]), location)).toBe('Alexandria');
  });

  it('does not mistake a job title line or the name line for a location', () => {
    const r = extractContactSuggestions('Hassan, Sara\nSoftware Engineer, Backend\nsara@example.com', [location]);
    expect(answerFor(r, location)).toBeUndefined();
  });

  it('finds a Question by its Preset key wherever it sits and whatever its label', () => {
    const relabelled = { ...linkedin, label: 'Where can we find you online?' } as FormField;
    const r = extractContactSuggestions(CV, [location, relabelled]);
    expect(answerFor(r, relabelled)).toBe('https://www.linkedin.com/in/sara-hassan');
  });

  it('ignores Questions with no Preset key, however they are labelled', () => {
    const handBuilt = { ...question(null, 'url'), label: 'LinkedIn profile' } as FormField;
    const r = extractContactSuggestions(CV, [handBuilt]);
    expect(r.answers).toEqual({});
  });

  it('suggests only for Questions on the form', () => {
    const r = extractContactSuggestions(CV, [github]);
    expect(Object.keys(r.answers)).toEqual([github.key]);
  });

  it('never offers an answer its Question would refuse', () => {
    const tight = question('contact.location', 'short_text', { maxLength: 5 });
    const r = extractContactSuggestions(CV, [tight]);
    expect(answerFor(r, tight)).toBeUndefined();
  });

  it('never offers a link longer than a url answer may be', () => {
    const text = `https://example.com/${'a'.repeat(2100)}`;
    expect(answerFor(extractContactSuggestions(text, [portfolio]), portfolio)).toBeUndefined();
  });
});
