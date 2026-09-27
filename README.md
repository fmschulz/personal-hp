# Frederik Schulz — Minimalist Personal Homepage

https://fmschulz.github.io/personal-hp/

A minimalist personal homepage in the Swiss / International Typographic style:
pure monochrome, a strict 12-column grid, big grotesque type, and monospace
metadata.

## Design

- **Lab Monochrome** — zero color by design; black on white, with a dark mode toggle
- **Typography** — Space Grotesk (display), Instrument Serif italic (accents), Instrument Sans (body), Space Mono (metadata)
- **Selected work** — a numbered index (highlights, recent papers, software, group, lab) with venue and year columns; papers link to their DOIs
- **Signature motif** — faint icosahedral capsids drift behind the masthead; click to add one
- **Lab** — `lab/virophage/` is an interactive WebGPU simulation, linked from the Work index
- **Motion** — masked headline reveals, hairline draws, GSAP + Lenis smooth scroll
- **Accessible** — respects `prefers-reduced-motion`; keyboard-focusable; graceful no-JS fallback

## Stack

- Static HTML5 + CSS3 (Grid / custom properties) + vanilla JavaScript
- [GSAP](https://gsap.com/) + ScrollTrigger, [Lenis](https://lenis.darkroom.engineering/)
- Hosted on GitHub Pages — no build step

## Develop

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Edit content in `index.html`, styling in `css/styles.css`, behavior in `js/animations.js`.
The Work index is generated from `data/work.json` (see Publications).

## Publications

The Work index in `index.html` is generated. `scripts/update_publications.py` rewrites everything
between `<!-- work:start -->` and `<!-- work:end -->`. The GitHub Actions workflow
`.github/workflows/publications.yml` runs it every Monday at 06:17 UTC (or on demand from the Actions
tab), commits `index.html` only when the list changed, and requests a Pages build.

| Source | Supplies |
|--------|----------|
| `data/work.json` | pinned papers for Highlights (DOI and a one-line description); software, group and lab entries |
| ORCID `0000-0002-4932-4677` | title, venue and year of each paper; the five newest journal articles for "Recent papers" |
| Crossref | metadata for a pinned DOI that is not on the ORCID record |
| OpenAlex | author lists; work types that identify errata and preprints; citation counts for ordering Highlights |

Highlights lists entries marked `"top": true` first, in file order, then the other pinned papers
by OpenAlex citation count, highest first. If a source fails or a pinned DOI does not resolve, the
script exits without writing. Edits made by
hand inside the generated block are overwritten on the next run.

### Pin a paper

1. Add `{"doi": "10.xxxx/...", "desc": "One line on what the paper found."}` to `selected` in
   `data/work.json`.
2. Preview the change:

   ```bash
   uv run scripts/update_publications.py --dry-run
   ```

3. Write it to `index.html`:

   ```bash
   uv run scripts/update_publications.py
   ```

Software, group and lab entries live in the same file under `groups`.

### Test the updater

```bash
uv run --no-project python -m unittest discover -s tests
```

## License

© 2026 Frederik Schulz. All rights reserved.
