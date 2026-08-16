# civarry.github.io

Source for [civarry.github.io](https://civarry.github.io/), my personal portfolio. It's a static site (GitHub Pages, no build step, no framework) built around a 3D constellation of my repos rendered with [three.js](https://threejs.org/) — each repo is a node, and the edges between them are drawn from embedding similarity rather than a hand-picked layout.

## How the constellation is built

A GitHub Action (`.github/workflows/update-repo-graph.yml`) runs nightly, pulls my public repos, embeds their descriptions/topics with `sentence-transformers` (MiniLM), and writes the pairwise similarity graph to `repo_graph.json` (`.github/scripts/build_repo_graph.py`). The frontend (`js/scene.js`, using the vendored `three.module.min.js`) reads that file and renders the repos as connected points you can rotate and click into.

Two more nightly jobs keep the rest of the site current, no manual updates needed:

- **Contributions** — fetches my GitHub contribution calendar via the GraphQL API and writes `contributions.json`, rendered as a heatmap.
- **Repo health** — `.github/scripts/audit_repos.py` audits every public repo against a documentation standard (description ≥15 chars, ≥3 topics, README with ≥300 characters of real visible text) and writes `repo_health.json`. It can also open/close a checklist issue per repo (`MANAGE_ISSUES=1`) so gaps show up as actual GitHub issues, not just a JSON file nobody reads.

## Other pages

- **`/apps/`** — a directory of shipped apps and tools (`js/apps.js` holds the data — add an object, get a tile, no other code to touch). Live GitHub stats (stars, last-updated) are pulled per app when a `repo` field is set.
- **`/eyerest/`** — a standalone privacy policy page for one of the listed apps.

## Backend integration

Per the site's CSP, it only talks to `api.github.com` and a Supabase project — there's a small always-on backend (Streamlit + Supabase + a Telegram bot) that drives the announcement banner and other dynamic bits shown on the homepage, so the whole thing stays interactive without needing a server this repo pays for.

## Stack

Vanilla HTML/CSS/JS, three.js for the 3D scene, GitHub Actions for the nightly data jobs (Python: `sentence-transformers`, `numpy`, stdlib `urllib`), GitHub Pages for hosting.

## Local development

There's no build step — open `index.html` directly, or serve the directory with any static file server:

```bash
python3 -m http.server 8000
```
