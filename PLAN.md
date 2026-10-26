# Peppy the Peptide — public Azure MVP plan (review draft)

## Goal and scope

Turn the existing local Peppy comic prototype into a **public, mobile-first course site** in a fresh `ianlintner/peppy-the-peptide` GitHub repository, deployed to a new Azure Static Web App Free instance at its default `azurestaticapps.net` URL. A custom domain is later. Public code is MIT; supplied Peppy and derivative art are explicitly excluded and marked rights reserved. No audio, video, commerce, login, database, online image generator, or server-side API in the MVP.

**Surface:** Decide/Learn. A reader lands on a course map, opens a lesson, sees an original 2–3 panel comic, then switches between Curious / College / Mechanism notes, and can open sourced definitions, caveats, and a short self-check. Avoid a gallery of pretty images with thin teaching; text, diagram, source and limitations must carry equal weight. The existing three selected panels, color system, catchphrase, and mascot reference are the visual baseline, not a mandate to have four panels everywhere.

## Course release

- **01 Foundations:** amino-acid sequence, peptide bonds, how bead cartoons differ from molecular structures (three approved panels exist).
- **02 Signal cast:** insulin and glucagon as contrasting peptide-hormone signals; an introductory comparison, not treatment guidance (target three scenes).
- **03 Endogenous GLP-1:** origin, receptor, glucose-dependent insulin response, and why a signal has a brief lifetime; distinguish hypothesis, simplified explanation and evidence (target three scenes).
- **04 Hormone ≠ medicine:** what GLP-1 receptor agonists are at a class level, why pharmacology is not a synonym for the native hormone, approved/unapproved distinction and safety boundaries (target two or three scenes). No product efficacy numbers, dosing, procurement, comparative prescribing or clinical recommendations without a named qualified reviewer.

Each lesson includes: a one-sentence learning objective; accessible panel alt text and separate editable dialogue; a short explanation at each depth; one accurate mechanism diagram or linked source; a “metaphor breaks here” note; a source list with dates; one small check-for-understanding. The graduate/professional layer is **a mechanism entry point**, not a claim of full graduate-level coverage at launch. Future issues can add GPCR pathways, pharmacokinetics, trial interpretation and other peptides after review.

## Architecture and deployment

Keep a static, dependency-light multi-page site rather than a server or a full SPA: `index.html` course map, `lessons/*.html`, shared CSS/JS, optimized WebP/JPEG selected art, `staticwebapp.config.json`, generated sitemap and license/rights/attribution. Preserve working responsive behavior from the prototype but split its long inline CSS/JS into maintainable files. Asset budget target: ~300 KB per panel variant at display size, with original masters retained locally and only selected web derivatives public. No fal key in repository, browser, Azure app settings or GitHub Actions; generation remains an offline editorial process. For deployment, use Azure Static Web Apps Free with GitHub Actions on `main` after test and content QA; if App workflow-write permission or Azure token wiring is unavailable, deploy the vetted same static artifact using CLI first and keep automation as a separate gate—not a reason to expose a credential. Verify the public remote tree, bot authorship, workflow, deployment URL, all four routes, image loads, mobile viewport, headers, and source links. Roll back by redeploying the last known-good artifact or revert the commit.

Live discovery: Azure CLI access works to subscription `Azure subscription 1`; five Static Web Apps currently exist (four Free, one Standard), and no matching Peppy GitHub repository appeared in the owner’s repo search. The prototype is a local directory, not a Git repository. Create a fresh clean history rather than publishing scratch/rejected images or local secrets. Do not modify existing Azure sites.

## Cost and volume (USD, directional, checked 2026-10-26)

- **Hosting:** Azure Static Web Apps Free is $0 base with TLS and up to two custom domains; its Free quota is 250 MB per environment, 500 MB total, and 100 GB/month included bandwidth **per subscription** shared with existing apps. Free stops serving if quota is exceeded, rather than charging overage; domain registration, if later chosen, is separate. [2][3]
- **CI:** standard GitHub-hosted Actions runners in a public repository are free; avoid larger runners and paid artifact storage. [4]
- **Image model:** fal `google/nano-banana-2.1/edit` charges by actual token use. Published representative **1K edit with two 1K input images: $0.044 per successful output**, excluding thinking and search tokens; 2K is ~$0.063 and 4K ~$0.138 under the same assumptions. These are examples, not invoice guarantees. [1]
- **MVP volume:** target ~12 selected panels total (three already selected, nine new). Generate each scene separately with one first pass and at most one targeted correction; **18 new outputs maximum** without another owner decision. At $0.044 base that is ~$0.79 for new outputs; 22 total attempts including four earlier outputs are ~$0.97 base. Allow for additional thinking/input variance and set a **$10 owner-approved ceiling for additional image generation**, not a promise of a provider-enforced cap. A 36-final-panel future course at 1.5–2 attempts/panel is 54–72 outputs, ~$2.38–$3.17 base before thinking, revisions, tax or price changes. [1]
- **Control limitations:** the current fal key successfully runs images but the fal account usage API returned HTTP 403 (it requires an Admin key); therefore actual accrued charges cannot be read here. Log request count/model/resolution locally and reconcile the fal billing dashboard before each new batch. fal is prepaid, but without a provider-enforced spend limit or admin usage access the local counter is a *soft* guard: never auto-loop on QA failure. [1][5]
- **Traffic:** 12 optimized panels at an illustrative 300 KB each would total ~3.5 MB of panel files, far below the 250 MB per-environment quota. If a visit transfers 1.5 MB of art/site and the subscription’s entire shared 100 GB were available, the arithmetic ceiling is ~68,000 full visits/month; real capacity is lower because other sites share bandwidth and caching/visitor behavior varies. This is not a traffic forecast. [2]

## Image-production quality gate

1. **Lesson-first:** author a source pack and one-page storyboard (claim, exactly what changes visually, exact diagram labels/colors/order, audience, metaphor boundary). Reject unsupported medical claims **before** calling fal.
2. **One approved key frame:** reference original Peppy plus an accepted scene, pin model, aspect ratio, 1K, medium thinking and no generated lettering. Generate one scene at a time; no bulk `num_images`, no web-search grounding for medical facts.
3. **QA before spend again:** inspect mascot seven-sphere count, wink, coat/gloves/shoes, limbs, exact controlled variable (sequence permutation vs composition), label-free art, anatomy, and scientific implication. Record pass/fail reason, not a vague aesthetic score. Use a deterministic SVG/HTML diagram for chemical structures and labels instead of AI art where precision matters.
4. **One correction max:** make a targeted reference edit if the exact error is repairable. If still wrong, park that panel for human decision and substitute a clear non-generated diagram; do not run open-ended regeneration loops. Human approves the lesson’s visual direction once, not every tiny art variation.
5. **Publish only selected assets:** convert to WebP/JPEG with responsive sizes, keep captions/source/caveats in HTML, preserve prompt/model/QA manifest separately, and exclude rejected drafts/source key from public Git history. A qualified human checks detailed clinical assertions before they become public. Accessibility, phone legibility and factual review are publication gates.

## Cards and acceptance

| # | Card | Depends on | Assignee / route | Verifiable acceptance |
|---|---|---|---|---|
| 1 | Scaffold: clean public repo, toolchain, lint/test harness, CI, README | approval | coder-claude / smart-v2 | Fresh single-commit App-authored history; MIT excludes art; no secrets/rejected art; static checks green; remote readback. |
| 2 | Course IA + responsive lesson template | 1 | coder-claude / smart-v2 | Four navigable routes, one mobile course map, accessible depth controls and sources; browser smoke at 390px and desktop. |
| 3 | Port Foundation lesson + existing approved Peppy panels | 2 | coder-claude / smart-v2 | Three selected panels, valid alt/dialogue, mechanisms/caveats, source links, self-check; no unselected drafts public. |
| 4 | Source packs/storyboards for signal cast, endogenous GLP-1, and medicine boundary | 1 | planner-claude / smart-planner | Every panel has a claim, controlled visual variable, exact primary source, metaphor limit and medical-review flag before generation. |
| 5 | Bounded artwork production + QA manifest | 4 | coder-claude / smart-v2 | ≤18 new 1K outputs for ~9 selected panels; rejected drafts excluded; manifest and sizes checked; any exception needs Ian’s approval. |
| 6 | Publishable lessons 02–04 + course progression | 2,4,5 | coder-claude / smart-v2 | Four lessons have three depths, sources, self-checks; no unreviewed product efficacy/dosing claims; desktop/mobile QA and independent medical-claim review gate. |
| 7 | Azure Static Web Apps Free deployment + CI/CD | 3,6 | coder-claude / smart-v2 | New isolated resource; exact public HTTPS URL, live route/image/source checks, no API key in client/repo, rollback tested. |
| 8 | MVP integration check, architecture consolidation and README usage | all | planner-claude / smart-planner | Re-read live and repo artifacts; accessibility/link/content checklist, actual image count and fal spend estimate, release caveats and ownership documented. |

Card 1 is the baseline; later cards are linked/blocked until their code is merged into `main`, not merely marked done. Feature PRs go to Ian for review after agent review and CI; routine fixes may follow the standing low-risk policy. The actual Azure create and public push occur only after this plan is approved. If clinical reviewer availability delays lesson 04, publish its clearly non-clinical class-level explanation and mark detailed clinical sections “coming later,” rather than quietly lowering review criteria.

## Decisions / risks

- Confirm that Ian authorizes public distribution of the supplied GPT-generated mascot and derivatives, with rights reserved, before first public push. “All rights reserved” states intent but does not magically establish exclusive copyright in AI output.
- Default Azure hostname now; custom domain and registration later. No paid Standard plan, Azure Functions, Key Vault or image-generation backend for MVP.
- The fal production key has no Admin usage access; reconcile provider dashboard and stop generation on any uncertain bill. The $10 figure is an owner-approved **ceiling**, not an observed spend or an instruction to use the full amount.
- Google Fonts is an external runtime dependency in the prototype; self-host or use a deliberate fallback if accessibility/privacy/performance testing warrants it.

## Sources

[1] https://fal.ai/models/google/nano-banana-2.1/edit — fal Nano Banana 2.1 Edit pricing
    > "1K | $0.040 | $0.044"
    > "Thinking is billed as output text."
[2] https://learn.microsoft.com/en-us/azure/static-web-apps/quotas — Azure Static Web Apps quotas
    > "Included bandwidth (per month) | 100 GB | 100 GB"
    > "Storage (single environment) | 250 MB | 500 MB | 500 MB"
[3] https://azure.microsoft.com/en-us/pricing/details/app-service/static — Azure Static Web Apps pricing
    > "Get started today with the Free plan which provides free web hosting, SSL certificate, and custom domain to provide branded customizations to your app."
[4] https://docs.github.com/en/actions/concepts/billing-and-usage — GitHub Actions billing
    > "GitHub Actions usage is free for standard GitHub-hosted runners in public repositories"
[5] https://fal.ai/docs/platform-apis/v1/models/usage — fal usage API
    > "Admin API key must be prefixed with "Key ""
