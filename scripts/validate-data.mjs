import { startups } from '../src/data/startups.js';
import { validateStartupDataset } from '../src/data/schema.js';

const errors = validateStartupDataset(startups);

if (errors.length > 0) {
  console.error(`Startup data validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  const regions = new Set(startups.map((startup) => startup.region));
  const countries = new Set(startups.map((startup) => startup.country));
  console.log(`Validated ${startups.length} startups across ${countries.size} countries and ${regions.size} regions.`);
}
