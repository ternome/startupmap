import test from 'node:test';
import assert from 'node:assert/strict';
import { startups } from '../src/data/startups.js';
import {
  buildStartupUrl,
  filterStartups,
  getStartupSlugFromUrl,
  normalizeSearchValue,
  uniqueSorted,
} from '../src/lib/discovery.js';

test('normalizes case, whitespace and accents', () => {
  assert.equal(normalizeSearchValue('  SÃO Paulo '), 'sao paulo');
});

test('search covers name, city, country, sector, region and description', () => {
  assert.deepEqual(filterStartups(startups, { query: 'mistral' }).map(({ slug }) => slug), ['mistral-ai']);
  assert.ok(filterStartups(startups, { query: 'bengaluru' }).length >= 2);
  assert.ok(filterStartups(startups, { query: 'uruguay' }).some(({ slug }) => slug === 'dlocal'));
  assert.ok(filterStartups(startups, { query: 'aerospace' }).some(({ slug }) => slug === 'spacex'));
  assert.ok(filterStartups(startups, { query: 'africa' }).some(({ slug }) => slug === 'flutterwave'));
  assert.ok(filterStartups(startups, { query: 'rockets' }).some(({ slug }) => slug === 'spacex'));
});

test('combines sector and region filters', () => {
  const results = filterStartups(startups, { sector: 'Fintech', region: 'South Asia' });
  assert.deepEqual(results.map(({ slug }) => slug), ['phonepe', 'razorpay']);
});

test('empty filter state returns every startup in name order', () => {
  const results = filterStartups(startups);
  assert.equal(results.length, startups.length);
  assert.deepEqual(
    results.map(({ name }) => name),
    results.map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
  );
});

test('unique values are de-duplicated and sorted', () => {
  const sectors = uniqueSorted(startups, 'sector');
  assert.equal(sectors.filter((sector) => sector === 'Fintech').length, 1);
  assert.deepEqual(sectors, [...sectors].sort((a, b) => a.localeCompare(b)));
});

test('deep-link helpers round-trip a stable slug and discard unrelated state', () => {
  const url = buildStartupUrl('https://example.com/?query=old#map', 'mistral-ai');
  assert.equal(url.toString(), 'https://example.com/?startup=mistral-ai');
  assert.equal(getStartupSlugFromUrl(url), 'mistral-ai');
  assert.equal(buildStartupUrl(url).toString(), 'https://example.com/');
});
