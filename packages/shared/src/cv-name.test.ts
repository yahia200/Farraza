import { describe, expect, it } from 'vitest';
import type { CvLayout } from './cv-layout.js';
import { emailMatchRatio, findName, nameCandidates } from './cv-name.js';

// All text below is invented. These tests pin the gate and the measured features, not the weights
// in `scoreNameFeatures`, so they stay true when those are tuned.

describe('emailMatchRatio', () => {
  it('matches the words of a first.last address', () => {
    expect(emailMatchRatio(['Sara', 'Hassan'], 'sara.hassan@example.com')).toBe(1);
  });

  it('matches an initial plus surname address by the surname', () => {
    expect(emailMatchRatio(['Sara', 'Hassan'], 'shassan@example.com')).toBe(0.5);
  });

  it('gives 0 for a job title and an unrelated address', () => {
    expect(emailMatchRatio(['Software', 'Engineer'], 'sara.hassan@example.com')).toBe(0);
  });

  it('ignores accents and case', () => {
    expect(emailMatchRatio(['José', 'Álvarez'], 'jose.alvarez@example.com')).toBe(1);
  });

  it('is null (no information) without an email, for short words and for non-Latin names', () => {
    expect(emailMatchRatio(['Sara', 'Hassan'], undefined)).toBeNull();
    expect(emailMatchRatio(['Al', 'Li'], 'al.li@example.com')).toBeNull();
    expect(emailMatchRatio(['أحمد', 'محمد'], 'ahmed@example.com')).toBeNull();
  });
});

describe('nameCandidates', () => {
  it('keeps only lines that pass the gate, in CV order, with their position among non-blank lines', () => {
    const candidates = nameCandidates(
      ['Curriculum Vitae', '', 'Software Engineer', 'sara@example.com', 'Sara Hassan', 'I am a developer who builds things'],
      'sara@example.com',
    );
    expect(candidates.map((c) => [c.text, c.features.position])).toEqual([
      ['Software Engineer', 1],
      ['Sara Hassan', 3],
    ]);
  });

  it('flags job-title and institution words and all-capital lines', () => {
    const [role, caps, plain] = nameCandidates(['Software Engineer', 'SARA HASSAN', 'Sara Hassan'], undefined);
    expect(role?.features.roleWord).toBe(true);
    expect(caps?.features).toMatchObject({ allCaps: true, roleWord: false });
    expect(plain?.features.allCaps).toBe(false);
  });

  it('has no layout features without a layout', () => {
    const [candidate] = nameCandidates(['Sara Hassan'], undefined);
    expect(candidate?.features).toMatchObject({ relativeSize: null, bold: null, emailMatch: null });
  });

  it('reads size and bold from the layout line with the same text, relative to the biggest candidate', () => {
    const layout: CvLayout = {
      lines: [
        { text: 'Sara   Hassan', fontSize: 24, bold: true },
        { text: 'Software Engineer', fontSize: 12, bold: false },
      ],
    };
    const [name, role] = nameCandidates(['Sara Hassan', 'Software Engineer'], undefined, layout);
    expect(name?.features).toMatchObject({ relativeSize: 1, bold: true });
    expect(role?.features).toMatchObject({ relativeSize: 0.5, bold: false });
  });

  it('gives a line the layout does not know no layout features, and never adds a candidate from it', () => {
    const layout: CvLayout = { lines: [{ text: 'Someone Else', fontSize: 30, bold: true }] };
    const candidates = nameCandidates(['Sara Hassan'], undefined, layout);
    expect(candidates.map((c) => c.text)).toEqual(['Sara Hassan']);
    expect(candidates[0]?.features).toMatchObject({ relativeSize: null, bold: null });
  });

  it('only scans the first ten lines', () => {
    const lines = [...Array.from({ length: 10 }, () => ''), 'Sara Hassan'];
    expect(nameCandidates(lines, undefined)).toEqual([]);
  });
});

describe('findName', () => {
  it('returns undefined when no line passes the gate', () => {
    expect(findName(['Resume', 'one'], undefined)).toBeUndefined();
  });

  it('returns a candidate that passed the gate', () => {
    expect(findName(['Curriculum Vitae', 'Laila Nabil'], 'laila@example.com')).toBe('Laila Nabil');
  });
});

describe('findName ranking', () => {
  it('takes the first candidate when nothing else tells them apart', () => {
    expect(findName(['Omar Khaled', 'Cairo Egypt'], undefined)).toBe('Omar Khaled');
  });

  it('prefers the name over a job title above it', () => {
    expect(findName(['Software Engineer', 'Sara Hassan'], undefined)).toBe('Sara Hassan');
    expect(findName(['Cairo University', 'Sara Hassan'], 'sara.hassan@example.com')).toBe('Sara Hassan');
  });

  it('uses the email to pick between two plausible lines', () => {
    expect(findName(['Full Stack', 'Sara Hassan'], 'sara.hassan@example.com')).toBe('Sara Hassan');
    expect(findName(['Sara Hassan', 'Full Stack'], 'shassan@example.com')).toBe('Sara Hassan');
  });

  it('does not need the email: a different address leaves the first line winning', () => {
    expect(findName(['Sara Hassan', 'Full Stack'], 'contact@example.com')).toBe('Sara Hassan');
  });

  it('prefers the biggest text on the page over an earlier, smaller line', () => {
    const layout: CvLayout = {
      lines: [
        { text: 'Full Stack', fontSize: 12, bold: false },
        { text: 'Sara Hassan', fontSize: 26, bold: false },
      ],
    };
    expect(findName(['Full Stack', 'Sara Hassan'], undefined, layout)).toBe('Sara Hassan');
  });

  it('does not penalise a name in Arabic script for failing to match a Latin email', () => {
    expect(findName(['أحمد محمد', 'Full Stack'], 'ahmed.mohamed@example.com')).toBe('أحمد محمد');
  });

  it('finds a name that shares its line with a phone number or other details', () => {
    expect(findName(['Sara Hassan  +20-1012345678'], undefined)).toBe('Sara Hassan');
    expect(findName(['Sara Hassan | Cairo | sara@example.com'], undefined)).toBe('Sara Hassan');
  });

  it('keeps a name with a double space in it as one name', () => {
    expect(findName(['  Omar  Khaled  '], undefined)).toBe('Omar Khaled');
  });

  it('does not take an icon glyph plus a link label, or a heading, as a name', () => {
    // "ï" is how a symbol font's LinkedIn icon can come out of a PDF.
    expect(findName(['ï LinkedIn Profile', 'Personal Information'], undefined)).toBeUndefined();
    expect(findName(['§ GitHub Profile', 'Sara Hassan'], undefined)).toBe('Sara Hassan');
  });

  it('accepts an initial written with a full stop', () => {
    expect(findName(['Sara J. Hassan'], undefined)).toBe('Sara J. Hassan');
    expect(findName(['Sara J Hassan'], undefined)).toBeUndefined();
  });

  it('takes the layout size from the line that holds a name found in a segment', () => {
    const layout: CvLayout = {
      lines: [
        { text: 'Full Stack', fontSize: 11, bold: false },
        { text: 'Sara Hassan +20-1012345678', fontSize: 20, bold: false },
      ],
    };
    const [stack, name] = nameCandidates(['Full Stack', 'Sara Hassan  +20-1012345678'], undefined, layout);
    expect(stack?.features.relativeSize).toBeCloseTo(0.55);
    expect(name?.features.relativeSize).toBe(1);
  });

  it('gives nothing for no lines or only blank lines', () => {
    expect(findName([], undefined)).toBeUndefined();
    expect(findName(['', '   ', ''], 'sara@example.com')).toBeUndefined();
  });

  it('breaks an exact tie in favour of the earlier line', () => {
    const layout: CvLayout = {
      lines: [
        { text: 'Omar Khaled', fontSize: 20, bold: false },
        { text: 'Sara Hassan', fontSize: 20, bold: false },
      ],
    };
    // Same size, no email, no other signal: only position differs.
    expect(findName(['Omar Khaled', 'Sara Hassan'], undefined, layout)).toBe('Omar Khaled');
  });

  it('counts the tenth line but not the eleventh', () => {
    const blanksThen = (n: number) => [...Array.from({ length: n }, () => ''), 'Sara Hassan'];
    expect(findName(blanksThen(9), undefined)).toBe('Sara Hassan'); // 10th line
    expect(findName(blanksThen(10), undefined)).toBeUndefined(); // 11th line
  });

  it('lets a wrong or missing layout fall back to the text alone', () => {
    const layout: CvLayout = { lines: [{ text: 'Unrelated Text', fontSize: 40, bold: true }] };
    expect(findName(['Omar Khaled', 'Cairo Egypt'], undefined, layout)).toBe('Omar Khaled');
  });
});
