# StartupMap

StartupMap is a map-first directory of startups around the world. Explore companies by country, discover local ecosystems, and open a quick profile for each startup.

## MVP

- Interactive world map powered by Leaflet and OpenStreetMap
- Startup markers with sector, stage, country, and short description
- Search and sector filtering
- Responsive dark interface inspired by map-based discovery products such as [warmap.lol](https://warmap.lol/)

## Run locally

This first version is a static site. Serve the directory with any local web server, for example:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Next steps

- Connect a real startup dataset and add submissions
- Add country and city pages
- Add startup profiles, founders, funding, and links
- Add moderation and data freshness workflows
- Move map and search data to an API/database

