export const STARTUP_REGIONS = [
  'Africa',
  'East Asia',
  'Europe',
  'Latin America',
  'Middle East',
  'North America',
  'Oceania',
  'South Asia',
  'Southeast Asia',
];

export const REQUIRED_STARTUP_FIELDS = [
  'slug',
  'name',
  'website',
  'city',
  'country',
  'region',
  'coordinates',
  'sector',
  'description',
  'sources',
  'lastVerified',
];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateStartup(startup, index = 0) {
  const label = startup?.slug || `record ${index + 1}`;
  const errors = [];

  if (!startup || typeof startup !== 'object' || Array.isArray(startup)) {
    return [`Record ${index + 1} must be an object.`];
  }

  for (const field of REQUIRED_STARTUP_FIELDS) {
    if (startup[field] === undefined || startup[field] === null || startup[field] === '') {
      errors.push(`${label}: missing ${field}.`);
    }
  }

  if (!slugPattern.test(startup.slug || '')) errors.push(`${label}: slug is not URL-safe.`);
  if (!isHttpsUrl(startup.website)) errors.push(`${label}: website must be an HTTPS URL.`);
  if (!STARTUP_REGIONS.includes(startup.region)) errors.push(`${label}: unknown region "${startup.region}".`);

  if (!Array.isArray(startup.coordinates) || startup.coordinates.length !== 2) {
    errors.push(`${label}: coordinates must be [latitude, longitude].`);
  } else {
    const [latitude, longitude] = startup.coordinates;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push(`${label}: invalid latitude.`);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push(`${label}: invalid longitude.`);
  }

  if (!Array.isArray(startup.sources) || startup.sources.length === 0) {
    errors.push(`${label}: at least one source URL is required.`);
  } else if (startup.sources.some((source) => !isHttpsUrl(source))) {
    errors.push(`${label}: every source must be an HTTPS URL.`);
  }

  if (!datePattern.test(startup.lastVerified || '') || Number.isNaN(Date.parse(startup.lastVerified))) {
    errors.push(`${label}: lastVerified must be a valid YYYY-MM-DD date.`);
  }

  if (startup.foundedYear !== undefined && (!Number.isInteger(startup.foundedYear) || startup.foundedYear < 1800 || startup.foundedYear > 2100)) {
    errors.push(`${label}: foundedYear is invalid.`);
  }

  const textFields = ['name', 'city', 'country', 'sector', 'description'];
  for (const field of textFields) {
    if (typeof startup[field] !== 'string' || startup[field].trim() !== startup[field] || startup[field].length < 2) {
      errors.push(`${label}: ${field} must be a trimmed, non-empty string.`);
    }
  }

  return errors;
}

export function validateStartupDataset(startups) {
  if (!Array.isArray(startups)) return ['Dataset must export an array.'];

  const errors = startups.flatMap(validateStartup);
  const slugs = new Set();
  const websites = new Set();

  startups.forEach((startup) => {
    if (slugs.has(startup.slug)) errors.push(`${startup.slug}: duplicate slug.`);
    slugs.add(startup.slug);
    if (websites.has(startup.website)) errors.push(`${startup.slug}: duplicate website.`);
    websites.add(startup.website);
  });

  if (startups.length < 24 || startups.length > 40) errors.push('Dataset must contain between 24 and 40 startups.');
  if (new Set(startups.map((startup) => startup.region)).size < 6) errors.push('Dataset must cover at least six regions.');

  return errors;
}
