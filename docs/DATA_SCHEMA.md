# Startup data schema

StartupMap ships a deliberately small, manually curated dataset in
`src/data/startups.js`. Every build runs `npm run validate:data`.

## Record fields

| Field | Type | Notes |
| --- | --- | --- |
| `slug` | string | Stable lowercase URL key; unique and hyphen-separated. |
| `name` | string | Canonical public company name. |
| `website` | HTTPS URL | Company website. |
| `city` | string | Mapped headquarters or documented operating hub. |
| `country` | string | Display country. |
| `region` | enum | One of the regions declared in `src/data/schema.js`. |
| `coordinates` | `[number, number]` | Approximate city-centroid latitude and longitude, not a street address. |
| `sector` | string | Broad discovery category; not a claim about every business line. |
| `description` | string | Short factual product summary. |
| `sources` | HTTPS URL[] | At least one public source supporting the record. |
| `lastVerified` | `YYYY-MM-DD` | Date a curator last checked the linked evidence. |
| `foundedYear` | integer, optional | Only when reasonably verified. |
| `stage` | string, optional | Only when current and reasonably verified. |

The validator rejects missing required fields, unsafe URLs, invalid coordinates,
duplicate slugs/websites, invalid dates, and insufficient geographic coverage.
Omit uncertain facts rather than inferring them.
