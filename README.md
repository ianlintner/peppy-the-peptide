# Peppy the Peptide

A comic-first, source-linked course about peptides and molecular signaling. Four short lessons move from amino-acid chains through insulin/glucagon, the body's GLP-1, and the distinction between hormone and GLP-1 receptor-agonist medicine. Every lesson has two or three original Peppy panels, editable dialogue and alt text, three explanation depths, a metaphor limit, a self-check, and sources.

**Azure site:** https://mango-tree-03457b90f.6.azurestaticapps.net/ (deployment pending; do not treat this as a live course link until verified)

## Local check

```sh
python scripts/build.py
python scripts/check.py
python -m unittest discover -s tests          # game-item validator tests
node --test "site/games/**/__tests__/*.test.js"   # engine tests (Node 22+, no package.json)
python -m http.server 8000 --directory site
```

Open http://localhost:8000/. The site is static HTML/CSS/JS; no client API calls or runtime image generation. `content/*.json` is the editorial source, `scripts/build.py` renders pages to `site/`, and CI fails if generated pages differ from committed output. `site/assets/` contains only selected optimized images; rejected experiments and private production manifests never go in Git.

## Production workflow and costs

Plan, course scope, fal output counts and source-checked estimates: [PLAN.md](PLAN.md). For every new scene, write the claim and exact controlled visual variable first; generate one reference-conditioned 1K image, QA character and science, permit at most one targeted correction, then use an HTML/SVG diagram or defer rather than looping. The current release selected nine panels total from eleven generation attempts across the prototype and new lessons; this is an **output count**, not a billed-cost measurement. The fal key is local and is not in this repository or the web app.

GitHub Actions runs the deterministic course check on PRs and `main`. Deployment is deliberately manual for the MVP: after the reviewed feature PR is merged, run `bash scripts/deploy.sh production` from a clean, exact `origin/main` checkout. The script reads the Azure deployment token at runtime from Azure CLI and never stores it in the public repo. The IkitClaw App can push workflow files but currently receives HTTP 403 for repository Actions-secret access, so a token-dependent auto-deploy job would fail. The default Azure hostname is used now; custom domain and automatic deploy can be added later with appropriate App permissions.

## Rights and safety

Site software is [MIT licensed](LICENSE). Peppy mascot art and derivative visual assets are **excluded** from the software license and reserved by their rights holder; see the site's [art disclosure](site/rights.html). AI-generated material may have limits on copyright protection under applicable law. Public visibility and the MIT code license are not permission to reuse the art.

This is educational satire, **not medical advice** or a product recommendation. Cartoon beads and props are analogies, not molecular diagrams. Detailed clinical claims, dose guidance, comparative efficacy and treatment decisions are out of scope until qualified clinical review. Mechanism-depth notes are an entry point, not a complete graduate curriculum.
