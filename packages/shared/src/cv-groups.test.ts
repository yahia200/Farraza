import { describe, expect, it } from 'vitest';
import type { Answers } from './answers.js';
import { extractContactSuggestions } from './cv-contacts.js';
import { extractGroupAnswers } from './cv-groups.js';
import type { FormField } from './form-fields.js';
import type { PresetKey } from './preset-keys.js';

// All CV text below is invented.

const id = () => crypto.randomUUID();

function leaf(presetKey: PresetKey | null, type: string, config: object, required = false): FormField {
  return { key: id(), type, label: 'Whatever the recruiter called it', helpText: null, required, presetKey, config } as FormField;
}

const DEGREE_LABELS = ['High school', 'Diploma', "Bachelor's", "Master's", 'Doctorate', 'Other'];

function educationGroup(maxEntries = 5) {
  const children = {
    school: leaf('education.school', 'short_text', { maxLength: 150 }, true),
    degree: leaf('education.degree', 'single_select', { options: DEGREE_LABELS.map((label) => ({ id: id(), label })) }, true),
    field: leaf('education.field_of_study', 'short_text', { maxLength: 150 }),
    start: leaf('education.start_year', 'number', { min: 1950, max: 2100, integerOnly: true }),
    end: leaf('education.end_year', 'number', { min: 1950, max: 2100, integerOnly: true }),
  };
  const group = leaf('education', 'repeating_group', { maxEntries, fields: Object.values(children) });
  return { group, ...children };
}

function experienceGroup(maxEntries = 5) {
  const children = {
    title: leaf('experience.job_title', 'short_text', { maxLength: 100 }, true),
    company: leaf('experience.company', 'short_text', { maxLength: 100 }, true),
    start: leaf('experience.start_date', 'date', { min: null, max: null }, true),
    end: leaf('experience.end_date', 'date', { min: null, max: null }),
    description: leaf('experience.description', 'long_text', { maxLength: 1500 }),
  };
  const group = leaf('experience', 'repeating_group', { maxEntries, fields: Object.values(children) });
  return { group, ...children };
}

const edu = educationGroup();
const exp = experienceGroup();
const form = [edu.group, exp.group];

function entries(answers: Answers, group: FormField) {
  return answers[group.key] as Answers[] | undefined;
}

function optionId(field: FormField, label: string) {
  const options = (field.config as { options: { id: string; label: string }[] }).options;
  return options.find((o) => o.label === label)!.id;
}

const CV = `Sara Hassan
Cairo, Egypt

Experience
Senior Backend Engineer at Nile Systems
March 2021 - Present
- Built payment services
- Led a team of four

Backend Developer | Delta Labs
Jan 2018 – Feb 2021
- Wrote APIs

Education
Master of Science in Data Science
Alexandria University
2019 - 2021

Bachelor of Science in Computer Science
Cairo University
2013 - 2017

Skills
TypeScript, Postgres
`;

describe('extractGroupAnswers: sections and entries', () => {
  it('finds the right number of entries with their confident sub-answers', () => {
    const answers = extractGroupAnswers(CV, form);

    expect(entries(answers, exp.group)).toEqual([
      { [exp.title.key]: 'Senior Backend Engineer', [exp.company.key]: 'Nile Systems', [exp.start.key]: '2021-03-01' },
      { [exp.title.key]: 'Backend Developer', [exp.company.key]: 'Delta Labs', [exp.start.key]: '2018-01-01', [exp.end.key]: '2021-02-28' },
    ]);
    expect(entries(answers, edu.group)).toEqual([
      {
        [edu.school.key]: 'Alexandria University',
        [edu.degree.key]: optionId(edu.degree, "Master's"),
        [edu.start.key]: 2019,
        [edu.end.key]: 2021,
      },
      {
        [edu.school.key]: 'Cairo University',
        [edu.degree.key]: optionId(edu.degree, "Bachelor's"),
        [edu.start.key]: 2013,
        [edu.end.key]: 2017,
      },
    ]);
  });

  it('never fills the description or the field of study', () => {
    const answers = extractGroupAnswers(CV, form);
    for (const entry of [...entries(answers, exp.group)!, ...entries(answers, edu.group)!]) {
      expect(entry).not.toHaveProperty(exp.description.key);
      expect(entry).not.toHaveProperty(edu.field.key);
    }
  });

  it('accepts other common headings, in upper case and with colons', () => {
    const text = `WORK HISTORY:\nProduct Manager, Orbit Studio\n2016 - 2020\n\nACADEMIC BACKGROUND\nBSc Physics\nAin Shams University\n2010 - 2014\n`;
    const answers = extractGroupAnswers(text, form);
    expect(entries(answers, exp.group)).toHaveLength(1);
    expect(entries(answers, edu.group)![0]![edu.degree.key]).toBe(optionId(edu.degree, "Bachelor's"));
  });

  it('stops a section at the next heading', () => {
    const text = `Education\nBachelor of Arts\nDelta College\n2008 - 2012\n\nProjects\nDelta Tracker\n2020 - 2021\n`;
    expect(entries(extractGroupAnswers(text, form), edu.group)).toHaveLength(1);
  });
});

describe('extractGroupAnswers: staying quiet', () => {
  it('yields nothing for text with no recognisable section', () => {
    const text = `Sara Hassan\nI worked as a Software Engineer at Acme from 2015 to 2019 and studied at Cairo University.\n`;
    expect(extractGroupAnswers(text, form)).toEqual({});
  });

  it('yields nothing when a heading shares its line with the content', () => {
    expect(extractGroupAnswers('Education: Bachelor of Arts, Cairo University 2012 - 2016', form)).toEqual({});
  });

  it('skips a block with several date ranges rather than guess where entries start', () => {
    const text = `Experience\nDeveloper at Acme Corp\n2015 - 2017\nDeveloper at Beta Corp\n2017 - 2019\n`;
    expect(extractGroupAnswers(text, form)).toEqual({});
  });

  it('does not take prose for a job title or company', () => {
    const text = `Experience\nWorked as a manager of many people in the office\n2015 - 2017\n`;
    const [entry] = entries(extractGroupAnswers(text, form), exp.group)!;
    expect(entry).toEqual({ [exp.start.key]: '2015-01-01', [exp.end.key]: '2017-12-31' });
  });

  it('leaves the school blank when the line is not clean', () => {
    const text = `Education\nComputer Science, Cairo University\n2010 - 2014\n`;
    const [entry] = entries(extractGroupAnswers(text, form), edu.group)!;
    expect(entry).toEqual({ [edu.start.key]: 2010, [edu.end.key]: 2014 });
  });

  it('leaves the degree blank when the block names two levels', () => {
    const text = `Education\nBachelor and Master of Science\nCairo University\n2010 - 2014\n`;
    const [entry] = entries(extractGroupAnswers(text, form), edu.group)!;
    expect(entry).not.toHaveProperty(edu.degree.key);
  });

  it('leaves the degree blank when the form has no matching option', () => {
    const custom = educationGroup();
    (custom.degree.config as { options: unknown[] }).options = [{ id: id(), label: 'Undergraduate' }];
    const text = `Education\nBachelor of Arts\nCairo University\n2010 - 2014\n`;
    const [entry] = entries(extractGroupAnswers(text, [custom.group]), custom.group)!;
    expect(entry).not.toHaveProperty(custom.degree.key);
  });
});

describe('extractGroupAnswers: dates', () => {
  const experienceOf = (line: string) =>
    entries(extractGroupAnswers(`Experience\nQA Engineer at Acme Corp\n${line}\n`, form), exp.group)?.[0];

  it('reads month names, years and "Present"', () => {
    expect(experienceOf('September 2019 - Present')).toMatchObject({ [exp.start.key]: '2019-09-01' });
    expect(experienceOf('September 2019 - Present')).not.toHaveProperty(exp.end.key);
    expect(experienceOf('Sept 2019 to Dec 2020')).toMatchObject({ [exp.start.key]: '2019-09-01', [exp.end.key]: '2020-12-31' });
    expect(experienceOf('2017 - 2019')).toMatchObject({ [exp.start.key]: '2017-01-01', [exp.end.key]: '2019-12-31' });
    expect(experienceOf('03/2018 - 11/2019')).toMatchObject({ [exp.start.key]: '2018-03-01', [exp.end.key]: '2019-11-30' });
    expect(experienceOf('Jan 2020 - current')).not.toHaveProperty(exp.end.key);
  });

  it('leaves both dates blank when the range ends before it starts', () => {
    const entry = experienceOf('2020 - 2018');
    expect(entry).not.toHaveProperty(exp.start.key);
    expect(entry).not.toHaveProperty(exp.end.key);
  });

  it('leaves a date blank when it cannot be read', () => {
    const entry = experienceOf('Smarch 2020 - Present');
    expect(entry).not.toHaveProperty(exp.start.key);
  });

  it('reads dates written after the text on the same line', () => {
    const text = `Experience\nData Analyst, Orbit Studio (Feb 2014 - Mar 2016)\n`;
    expect(entries(extractGroupAnswers(text, form), exp.group)).toEqual([
      { [exp.title.key]: 'Data Analyst', [exp.company.key]: 'Orbit Studio', [exp.start.key]: '2014-02-01', [exp.end.key]: '2016-03-31' },
    ]);
  });

  it('treats "present" as an unfinished degree and a lone year as the finishing year', () => {
    const text = `Education\nMaster of Science\nCairo University\n2022 - Present\n\nDiploma in Design\nDelta Institute\nGraduated 2012\n`;
    const [first, second] = entries(extractGroupAnswers(text, form), edu.group)!;
    expect(first).toMatchObject({ [edu.start.key]: 2022 });
    expect(first).not.toHaveProperty(edu.end.key);
    expect(second).toMatchObject({ [edu.degree.key]: optionId(edu.degree, 'Diploma'), [edu.end.key]: 2012 });
    expect(second).not.toHaveProperty(edu.start.key);
  });

  it('drops a year or date that breaks the Question limits', () => {
    const strict = educationGroup();
    strict.end.config = { min: 1950, max: 2020, integerOnly: true };
    const text = `Education\nBachelor of Arts\nCairo University\n2014 - 2024\n`;
    const [entry] = entries(extractGroupAnswers(text, [strict.group]), strict.group)!;
    expect(entry).toMatchObject({ [strict.start.key]: 2014 });
    expect(entry).not.toHaveProperty(strict.end.key);
  });

  it('drops a company that is longer than the Question allows', () => {
    const short = experienceGroup();
    short.company.config = { maxLength: 5 };
    const text = `Experience\nQA Engineer at Nile Systems\n2019 - 2020\n`;
    const [entry] = entries(extractGroupAnswers(text, [short.group]), short.group)!;
    expect(entry).not.toHaveProperty(short.company.key);
    expect(entry).toMatchObject({ [short.title.key]: 'QA Engineer' });
  });
});

describe('extractGroupAnswers: the form decides', () => {
  const many = (n: number) =>
    `Experience\n${Array.from({ length: n }, (_, i) => `Engineer ${i} at Acme Corp\n${2000 + i} - ${2001 + i}\n`).join('\n')}`;

  it('respects maxEntries, keeping the first entries', () => {
    const limited = experienceGroup(2);
    const result = entries(extractGroupAnswers(many(4), [limited.group]), limited.group)!;
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ [limited.start.key]: '2000-01-01' });
  });

  it('drops fully blank entries', () => {
    const text = `Experience\nReferences on request\n\nQA Engineer at Acme Corp\n2019 - 2020\n`;
    expect(entries(extractGroupAnswers(text, form), exp.group)).toHaveLength(1);
  });

  it('suggests nothing for a form without an Education or Experience group', () => {
    const plain = leaf(null, 'short_text', { maxLength: 100 });
    const unkeyed = leaf(null, 'repeating_group', { maxEntries: 3, fields: [leaf(null, 'short_text', { maxLength: 100 })] });
    expect(extractGroupAnswers(CV, [plain, unkeyed])).toEqual({});
    expect(extractGroupAnswers(CV, [])).toEqual({});
  });

  it('finds sub-questions by Preset key and ignores ones without', () => {
    const only = leaf('experience', 'repeating_group', {
      maxEntries: 3,
      fields: [leaf(null, 'short_text', { maxLength: 100 }), leaf('experience.company', 'short_text', { maxLength: 100 })],
    });
    const result = entries(extractGroupAnswers(CV, [only]), only)!;
    const company = (only.config as { fields: FormField[] }).fields[1]!;
    expect(result).toEqual([{ [company.key]: 'Nile Systems' }, { [company.key]: 'Delta Labs' }]);
  });
});

describe('extractContactSuggestions includes group entries', () => {
  it('returns contacts and groups together in the same answers map', () => {
    const result = extractContactSuggestions(CV, form);
    expect(result.name).toBe('Sara Hassan');
    expect(Object.keys(result.answers).sort()).toEqual([edu.group.key, exp.group.key].sort());
  });
});
