/** Entry module for Claim Detective, mounted by scripts/build.py into lesson 4 (plumbing: ../ui/mount.js). */
import { mountGame } from '../ui/mount.js';
import { ClaimDetectiveRunner } from './ClaimDetectiveRunner.js';
import { validateItems } from './evaluator.js';

/** Preview banner: the capstone ships only while every post is still flagged for review. */
function decorate(el, data) {
  if (data.review_mode !== 'flagged' || !data.items.every((i) => i.needs_review === true)) return;
  const banner = document.createElement('p');
  banner.className = 'cd-preview-banner';
  banner.setAttribute('role', 'note');
  banner.textContent = 'Preview: every fictional post is awaiting clinical and regulatory review. '
    + 'Nothing here is medical advice.';
  el.appendChild(banner);
}

mountGame({ slug: 'claim-detective', name: 'Claim Detective', css: 'claim-detective/claims.css', runner: ClaimDetectiveRunner, validateItems, decorate });
