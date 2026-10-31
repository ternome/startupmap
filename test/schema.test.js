import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStartupValidationError,
  validateStartup,
  validateStartupDataset,
} from '../src/data/schema.js';

const validStartup = {
  slug: 'example-startup',
  name: 'Example Startup',
  website: 'https://example.com',
  city: 'Paris',
  country: 'France',
  region: 'Europe',
  coordinates: [48.857, 2.352],
  sector: 'Software',
  description: 'Builds useful software for example customers.',
  sources: ['https://example.com/about'],
  lastVerified: '2024-02-29',
};

test('rejects impossible calendar dates instead of allowing Date.parse normalization', () => {
  for (const lastVerified of ['2023-02-29', '2026-02-30', '2026-04-31', '2026-13-01']) {
    const errors = validateStartup({ ...validStartup, lastVerified });

    assert.ok(
      errors.some((error) => error.code === 'invalid_date' && error.field === 'lastVerified'),
      `${lastVerified} should be rejected`,
    );
  }

  assert.equal(validateStartup(validStartup).length, 0);
});

test('returns structured errors for null and malformed dataset records without throwing', () => {
  const errors = validateStartupDataset([null, 'not an object', []]);
  const recordErrors = errors.filter((error) => error.code === 'invalid_record');

  assert.deepEqual(recordErrors, [
    {
      code: 'invalid_record',
      path: '$[0]',
      message: 'must be an object.',
      recordIndex: 0,
      recordLabel: 'record 1',
    },
    {
      code: 'invalid_record',
      path: '$[1]',
      message: 'must be an object.',
      recordIndex: 1,
      recordLabel: 'record 2',
    },
    {
      code: 'invalid_record',
      path: '$[2]',
      message: 'must be an object.',
      recordIndex: 2,
      recordLabel: 'record 3',
    },
  ]);
  assert.equal(formatStartupValidationError(recordErrors[0]), 'record 1: must be an object.');
});

test('non-array datasets return a structured top-level error', () => {
  assert.deepEqual(validateStartupDataset(null), [
    {
      code: 'invalid_dataset',
      path: '$',
      message: 'Dataset must export an array.',
    },
  ]);
});
