export function normalizeSearchValue(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .trim();
}

export function searchableText(startup) {
  return normalizeSearchValue(
    [startup.name, startup.city, startup.country, startup.region, startup.sector, startup.description].join(' '),
  );
}

export function filterStartups(startups, filters = {}) {
  const query = normalizeSearchValue(filters.query);
  const sector = filters.sector || 'All sectors';
  const region = filters.region || 'All regions';

  return startups
    .filter((startup) => sector === 'All sectors' || startup.sector === sector)
    .filter((startup) => region === 'All regions' || startup.region === region)
    .filter((startup) => !query || searchableText(startup).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function uniqueSorted(startups, field) {
  return [...new Set(startups.map((startup) => startup[field]))].sort((a, b) => a.localeCompare(b));
}

export function getStartupSlugFromUrl(urlLike) {
  const url = urlLike instanceof URL ? urlLike : new URL(urlLike, 'https://startupmap.invalid');
  return url.searchParams.get('startup') || '';
}

export function buildStartupUrl(urlLike, slug = '') {
  const url = urlLike instanceof URL ? new URL(urlLike) : new URL(urlLike, 'https://startupmap.invalid');
  url.search = '';
  url.hash = '';
  if (slug) url.searchParams.set('startup', slug);
  return url;
}
