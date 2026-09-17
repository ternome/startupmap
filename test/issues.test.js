import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCorrectionIssueUrl, buildSubmissionIssueUrl } from '../src/lib/issues.js';

test('submission issue URL encodes supplied fields without treating them as query syntax', () => {
  const result = new URL(buildSubmissionIssueUrl({
    name: 'A&B',
    website: 'https://example.com/?a=1&b=2',
    city: 'Lagos',
    country: 'Nigeria',
    sector: 'Climate',
    description: 'Clean & useful.',
    source: 'https://example.com/about',
  }));

  assert.equal(result.origin, 'https://github.com');
  assert.equal(result.searchParams.get('title'), '[Submission] A&B');
  assert.match(result.searchParams.get('body'), /\*\*Website:\*\* https:\/\/example\.com\/\?a=1&b=2/);
});

test('correction issue points to the exact profile', () => {
  const result = new URL(buildCorrectionIssueUrl({
    slug: 'mistral-ai',
    name: 'Mistral AI',
    website: 'https://mistral.ai',
  }));

  assert.equal(result.searchParams.get('template'), 'data-correction.md');
  assert.match(result.searchParams.get('body'), /mistral-ai/);
});
