# AndroMiner website

The public site at andro-miner.vercel.app: landing page, `/docs` and `/stats`. It is separate from the Android app in `../src` and is never bundled into it.

```text
website/
├── landing.html, docs.html, stats.html   Page entries
├── vite.config.ts                        Build, dev server and route rewrites
├── public/                               Favicon
└── src/
    ├── site/      Shared tokens (site.css), header, footer, GitHub release parsing
    ├── landing/   Home page sections
    ├── docs/      Documentation app, Markdown in content/, generated component data
    └── stats/     Public statistics page
```

## Commands

Run from the repository root.

```bash
bun run dev:site                # dev server on :5174 with /, /docs and /stats
npm run build:site              # typecheck, then build into website/dist/
bun run preview:site            # serve the production build on :4173
npm run docs:components         # regenerate website/src/docs/components.generated.json
```

## Rules

- The website may import from the app's `src/utils` and use `../overview` and `../assets/brand`. The app never imports from `website/`.
- Docs pages are Markdown in `src/docs/content/<section>/<page>.md`; register new pages in `src/docs/nav.ts`.
- Release version, size and checksum always come from the GitHub API through `src/site/release.ts`.
- `vercel.json` at the repository root builds this folder and rewrites `/`, `/docs/*` and `/stats` to the right entry.
