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

function validationError(code, message, { field, index, label } = {}) {
  const hasRecord = Number.isInteger(index);
  const path = hasRecord
    ? `$[${index}]${field ? `.${field}` : ''}`
    : '$';

  return {
    code,
    path,
    message,
    ...(hasRecord ? { recordIndex: index, recordLabel: label || `record ${index + 1}` } : {}),
    ...(field ? { field } : {}),
  };
}

export function formatStartupValidationError(error) {
  const label = error.recordLabel ? `${error.recordLabel}: ` : '';
  return `${label}${error.message}`;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidCalendarDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

export function validateStartup(startup, index = 0) {
  const errors = [];

  if (!startup || typeof startup !== 'object' || Array.isArray(startup)) {
    return [validationError('invalid_record', 'must be an object.', { index })];
  }

  const label = typeof startup.slug === 'string' && startup.slug
    ? startup.slug
    : `record ${index + 1}`;
  const addError = (code, message, field) => {
    errors.push(validationError(code, message, { field, index, label }));
  };

  for (const field of REQUIRED_STARTUP_FIELDS) {
    if (startup[field] === undefined || startup[field] === null || startup[field] === '') {
      addError('missing_field', `missing ${field}.`, field);
    }
  }

  if (!slugPattern.test(startup.slug || '')) addError('invalid_slug', 'slug is not URL-safe.', 'slug');
  if (!isHttpsUrl(startup.website)) addError('invalid_url', 'website must be an HTTPS URL.', 'website');
  if (!STARTUP_REGIONS.includes(startup.region)) addError('unknown_region', `unknown region "${startup.region}".`, 'region');

  if (!Array.isArray(startup.coordinates) || startup.coordinates.length !== 2) {
    addError('invalid_coordinates', 'coordinates must be [latitude, longitude].', 'coordinates');
  } else {
    const [latitude, longitude] = startup.coordinates;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      addError('invalid_latitude', 'invalid latitude.', 'coordinates');
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      addError('invalid_longitude', 'invalid longitude.', 'coordinates');
    }
  }

  if (!Array.isArray(startup.sources) || startup.sources.length === 0) {
    addError('missing_sources', 'at least one source URL is required.', 'sources');
  } else if (startup.sources.some((source) => !isHttpsUrl(source))) {
    addError('invalid_source', 'every source must be an HTTPS URL.', 'sources');
  }

  if (!isValidCalendarDate(startup.lastVerified)) {
    addError('invalid_date', 'lastVerified must be a valid YYYY-MM-DD calendar date.', 'lastVerified');
  }

  if (startup.foundedYear !== undefined && (!Number.isInteger(startup.foundedYear) || startup.foundedYear < 1800 || startup.foundedYear > 2100)) {
    addError('invalid_founded_year', 'foundedYear is invalid.', 'foundedYear');
  }

  const textFields = ['name', 'city', 'country', 'sector', 'description'];
  for (const field of textFields) {
    if (typeof startup[field] !== 'string' || startup[field].trim() !== startup[field] || startup[field].length < 2) {
      addError('invalid_text', `${field} must be a trimmed, non-empty string.`, field);
    }
  }

  return errors;
}

export function validateStartupDataset(startups) {
  if (!Array.isArray(startups)) {
    return [validationError('invalid_dataset', 'Dataset must export an array.')];
  }

  const errors = startups.flatMap(validateStartup);
  const slugs = new Set();
  const websites = new Set();

  startups.forEach((startup, index) => {
    if (!startup || typeof startup !== 'object' || Array.isArray(startup)) return;

    const label = typeof startup.slug === 'string' && startup.slug
      ? startup.slug
      : `record ${index + 1}`;

    if (typeof startup.slug === 'string' && startup.slug) {
      if (slugs.has(startup.slug)) {
        errors.push(validationError('duplicate_slug', 'duplicate slug.', {
          field: 'slug', index, label,
        }));
      }
      slugs.add(startup.slug);
    }

    if (typeof startup.website === 'string' && startup.website) {
      if (websites.has(startup.website)) {
        errors.push(validationError('duplicate_website', 'duplicate website.', {
          field: 'website', index, label,
        }));
      }
      websites.add(startup.website);
    }
  });

  if (startups.length < 24 || startups.length > 40) {
    errors.push(validationError('dataset_size', 'Dataset must contain between 24 and 40 startups.'));
  }

  const regions = startups
    .filter((startup) => startup && typeof startup === 'object' && !Array.isArray(startup))
    .map((startup) => startup.region);
  if (new Set(regions).size < 6) {
    errors.push(validationError('insufficient_regions', 'Dataset must cover at least six regions.'));
  }

  return errors;
}
