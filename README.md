# Foofire.com

Foofire is a fast, fully static fan-made website to help users find the nearest upcoming Foo Fighters show.

Tagline: **Find the closest Foo Fighters concert to you.**

## Features

- ZIP code search via `https://api.zippopotam.us/us/{zip}`
- Haversine distance ranking in miles
- "Closest To You" badge for the nearest show
- Ticket links and copy-to-clipboard action
- Optional "Use My Location" geolocation search
- Dark, mobile-first responsive UI
- Dedicated legal disclaimer page

## Project Structure

```text
src/
  components/
  pages/
  data/
  utils/
public/
  data/
```

Concert data is stored in `/public/data/shows.json` and can be edited as new dates are announced.

## Local Preview

Because this project fetches local JSON files, serve it over HTTP instead of opening files directly:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages Deployment

This repository includes `.github/workflows/deploy.yml` to deploy automatically with GitHub Actions.

### Setup steps

1. In GitHub repository settings, enable **Pages** and set **Build and deployment** source to **GitHub Actions**.
2. Ensure your DNS points `foofire.com` to GitHub Pages.
3. Keep the `CNAME` file in the repository root with:

```text
foofire.com
```

On pushes to `main`/`master` (and Copilot branches), the workflow deploys the static site.

## Legal

Foofire is an unofficial fan site and is not affiliated with Foo Fighters, Roswell Records, RCA Records, the band's management, or any official entity.
