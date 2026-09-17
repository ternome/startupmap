export const REPOSITORY_ISSUES_URL = 'https://github.com/ternome/startupmap/issues/new';
export const REPOSITORY_ISSUE_CHOOSER_URL = 'https://github.com/ternome/startupmap/issues/new/choose';

function clean(value) {
  return String(value || '').trim();
}

export function buildSubmissionIssueUrl(fields) {
  const url = new URL(REPOSITORY_ISSUES_URL);
  const name = clean(fields.name);
  const body = [
    '## Startup submission',
    '',
    `**Company:** ${name}`,
    `**Website:** ${clean(fields.website)}`,
    `**City:** ${clean(fields.city)}`,
    `**Country:** ${clean(fields.country)}`,
    `**Sector:** ${clean(fields.sector)}`,
    '',
    '### Description',
    clean(fields.description),
    '',
    '### Public source',
    clean(fields.source),
    '',
    '### Submitter note',
    clean(fields.note) || '_None provided._',
    '',
    '---',
    'I understand this opens a public GitHub issue and that entries are reviewed before inclusion.',
  ].join('\n');

  url.searchParams.set('template', 'startup-submission.md');
  url.searchParams.set('title', `[Submission] ${name}`);
  url.searchParams.set('body', body);
  return url.toString();
}

export function buildCorrectionIssueUrl(startup) {
  const url = new URL(REPOSITORY_ISSUES_URL);
  const body = [
    '## Data correction',
    '',
    `**Startup:** ${startup.name}`,
    `**Profile slug:** ${startup.slug}`,
    `**Current website:** ${startup.website}`,
    '',
    '### What should change?',
    '<!-- Describe the correction. -->',
    '',
    '### Supporting public source',
    '<!-- Add a URL that supports the correction. -->',
  ].join('\n');

  url.searchParams.set('template', 'data-correction.md');
  url.searchParams.set('title', `[Correction] ${startup.name}`);
  url.searchParams.set('body', body);
  return url.toString();
}
