# Frederik Schulz, PhD — Personal Website

https://fmschulz.github.io/neobrutalist-hp/

A minimalist personal site in the Swiss / International Typographic style:
pure monochrome, a strict 12-column grid, big grotesque type, and monospace
metadata — with a single quiet signature element (a drifting dot-field network
that the cursor "discovers"), echoing the search for hidden life in sequence data.

## Design

- **Lab Monochrome** — zero color by design; black on white, with a dark mode toggle
- **Typography** — Space Grotesk (display), Inter (body), Space Mono (metadata)
- **Selected work** — presented as a numbered editorial index with invert-on-hover rows
- **Signature motif** — a faint, slow constellation that reveals connections near the pointer
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

## License

© 2026 Frederik Schulz. All rights reserved.
