"""Game item loading and validation, shared by build.py, check.py and the unit tests.

Stdlib only. The schema is documented in content/games/SCHEMA.md; every rule
enforced here must appear there, and vice versa.
"""
from __future__ import annotations
import json, re
from pathlib import Path

SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
# Safety lint (plan: no dosing, efficacy numbers, brand/product comparisons). Deliberately
# blunt: a hit means a human must rewrite the item or add a reviewed, narrower exception here.
DOSE = re.compile(r'\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|ug|iu|ml|units?)\b', re.I)
BRANDS = re.compile(r'\b(?:ozempic|wegovy|rybelsus|mounjaro|zepbound|victoza|saxenda|trulicity|byetta|bydureon|'
                    r'semaglutide|tirzepatide|liraglutide|dulaglutide|exenatide)\b', re.I)
SKIP_LINT_KEYS = {'id', 'game', 'lesson', 'concept'}


def is_fixture(path: Path) -> bool:
    """Files starting with '_' are test fixtures: validated, never built into site/."""
    return path.name.startswith('_')


def game_files(games_dir: Path) -> list[Path]:
    return sorted(games_dir.glob('*.json')) if games_dir.is_dir() else []


def _nonblank(v) -> bool:
    return isinstance(v, str) and v.strip() != ''


def _is_int(v) -> bool:
    return type(v) is int  # bool is an int subclass; reject it


def _strings(node, key=None):
    if isinstance(node, str):
        if key not in SKIP_LINT_KEYS:
            yield node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from _strings(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from _strings(v, key)


def _validate_choices(item, where):
    errs = []
    choices = item.get('choices')
    if not isinstance(choices, list) or len(choices) < 2:
        return [f'{where}.choices: need a list of at least 2 choices']
    ids, correct = set(), 0
    for j, c in enumerate(choices):
        cw = f'{where}.choices[{j}]'
        if not isinstance(c, dict):
            errs.append(f'{cw}: must be an object')
            continue
        cid = c.get('id')
        if not (isinstance(cid, str) and SLUG.match(cid)):
            errs.append(f'{cw}.id: must be a lowercase-hyphen slug')
        elif cid in ids:
            errs.append(f'{cw}.id: duplicate choice id {cid!r}')
        else:
            ids.add(cid)
        if not _nonblank(c.get('text')):
            errs.append(f'{cw}.text: must be non-empty text')
        if not isinstance(c.get('correct'), bool):
            errs.append(f'{cw}.correct: must be a boolean')
        elif c['correct']:
            correct += 1
        elif not _nonblank(c.get('feedback')):
            errs.append(f'{cw}.feedback: every distractor needs misconception-specific feedback')
    if correct != 1:
        errs.append(f'{where}.choices: exactly one choice must have correct=true (found {correct})')
    return errs


def _validate_item(item, i, source_count):
    where = f'items[{i}]'
    if not isinstance(item, dict):
        return [f'{where}: must be an object']
    errs = []
    if not (isinstance(item.get('id'), str) and SLUG.match(item['id'])):
        errs.append(f'{where}.id: must be a lowercase-hyphen slug')
    if not (isinstance(item.get('concept'), str) and SLUG.match(item['concept'])):
        errs.append(f'{where}.concept: must be a lowercase-hyphen slug (mastery is tracked per concept)')
    tier = item.get('tier')
    if not _is_int(tier) or not 1 <= tier <= 3:
        errs.append(f'{where}.tier: required integer 1, 2 or 3 (Curious/College/Mechanism)')
    for key in ('misconception', 'prompt', 'explanation'):
        if not _nonblank(item.get(key)):
            errs.append(f'{where}.{key}: must be non-empty text')
    errs += _validate_choices(item, where)
    ladder = item.get('hint_ladder', [])
    if not isinstance(ladder, list) or not all(_nonblank(h) for h in ladder):
        errs.append(f'{where}.hint_ladder: must be a list of non-empty strings')
    elif _is_int(tier) and tier in (1, 2) and len(ladder) < 2:
        errs.append(f'{where}.hint_ladder: tier {tier} items need at least 2 hints')
    ids = item.get('source_ids')
    if not isinstance(ids, list) or not ids:
        errs.append(f'{where}.source_ids: need a non-empty list of lesson source numbers')
    else:
        if not all(_is_int(s) for s in ids) or len(set(ids)) != len(ids):
            errs.append(f'{where}.source_ids: must be unique integers')
        else:
            bad = [s for s in ids if not 1 <= s <= source_count]
            if bad:
                errs.append(f'{where}.source_ids: {bad} not in the lesson sources (valid: 1..{source_count})')
    if not isinstance(item.get('needs_review'), bool):
        errs.append(f'{where}.needs_review: required boolean (true holds the item out of the public build)')
    if 'worked_example' in item and not _nonblank(item['worked_example']):
        errs.append(f'{where}.worked_example: if present, must be non-empty text')
    if 'data' in item and not isinstance(item['data'], dict):
        errs.append(f'{where}.data: if present, must be an object')
    return errs


# --- bead-chain-builder: game-specific `data` rules (documented in content/games/SCHEMA.md) ---
RESIDUE = re.compile(r'^[ACDEFGHIKLMNPQRSTVWY]+$')
# UniProt segments fetched 2026-11-21 (rest.uniprot.org). Key: (accession, first residue number).
# A sequence-bearing item must quote a slice of one of these exactly; extend only after re-fetching.
VERIFIED_SEGMENTS = {
    ('P01275', 98): 'HAEGTFTSDVSSYLEGQAAKEFIAWLVKGR',   # GLP-1(7-36), 98-127
    ('P01275', 53): 'HSQGTFTSDYSKYLDSRRAQDFVQWLMNT',     # glucagon, 53-81
    ('P01308', 25): 'FVNQHLCGSHLVEALYLVCGERGFFYTPKT',    # insulin B chain, 25-54
    ('P01308', 90): 'GIVEQCCTSICSLYQLENYCN',             # insulin A chain, 90-110
}
BEAD_MODES = ('build', 'spot', 'compare', 'sorter', 'inference')
SORTER_BUCKETS = ('cartoon', 'real', 'both')


def _relation(a: str, b: str) -> str:
    if a == b:
        return 'same-sequence'
    return 'same-beads-new-order' if sorted(a) == sorted(b) else 'different-beads'


def _check_fragment(d, key, where, max_len, errs):
    """Validate a real-sequence block: residues string + accession + span, matched to VERIFIED_SEGMENTS."""
    seq = d.get(key)
    if not (isinstance(seq, str) and RESIDUE.match(seq) and 3 <= len(seq) <= max_len):
        errs.append(f'{where}.{key}: one-letter residue string of 3..{max_len} standard residues')
        return
    acc, span = d.get('accession'), d.get('residues')
    m = re.match(r'^(\d+)-(\d+)$', span) if isinstance(span, str) else None
    if not (isinstance(acc, str) and m) or not _nonblank(d.get('source_label')):
        errs.append(f'{where}: real sequences need accession, residues "start-end" and source_label')
        return
    start, end = int(m.group(1)), int(m.group(2))
    if end - start + 1 != len(seq):
        errs.append(f'{where}.residues: span {span} does not match the length of {seq!r}')
        return
    ok = any(a == acc and s <= start and end <= s + len(v) - 1 and v[start - s:end - s + 1] == seq
             for (a, s), v in VERIFIED_SEGMENTS.items())
    if not ok:
        errs.append(f'{where}: {seq!r} is not a verified UniProt {acc} slice at {span}')


def _validate_bead_item(item, where):
    d = item.get('data')
    if not isinstance(d, dict):
        return [f'{where}.data: bead-chain items need a data object']
    errs, w = [], f'{where}.data'
    mode = d.get('mode')
    if mode not in BEAD_MODES:
        return [f'{w}.mode: must be one of {", ".join(BEAD_MODES)}']
    if d.get('view', 'cartoon') not in ('cartoon', 'chemistry'):
        errs.append(f'{w}.view: must be "cartoon" or "chemistry"')
    cs = [c for c in item.get('choices', []) if isinstance(c, dict)]
    ids = [c.get('id') for c in cs]
    right = [c.get('id') for c in cs if c.get('correct') is True]
    if mode in ('build', 'spot', 'compare') or 'target' in d:
        _check_fragment(d, 'target', w, 7, errs)  # 7 = Peppy has seven spheres
    if mode == 'build':
        if sorted(ids) != ['differs', 'matches'] or right != ['matches']:
            errs.append(f'{where}.choices: build items use exactly the ids "matches" (correct) and "differs"')
    elif mode == 'spot':
        chains = d.get('chains')
        if not (isinstance(chains, dict) and sorted(chains) == sorted(ids) and all(
                isinstance(v, str) and RESIDUE.match(v) and len(v) <= 7 for v in chains.values())):
            errs.append(f'{w}.chains: one residue string per choice id')
        elif isinstance(d.get('target'), str):
            kinds = {c: _relation(d['target'], v) for c, v in chains.items()}
            only = [c for c, k in kinds.items() if k == 'same-beads-new-order']
            if len(only) != 1 or right != only:
                errs.append(f'{where}.choices: the correct chain must be the only same-beads-new-order chain')
    elif mode == 'compare':
        other = d.get('other')
        if not (isinstance(other, str) and RESIDUE.match(other) and len(other) <= 7):
            errs.append(f'{w}.other: residue string up to 7 residues')
        elif sorted(ids) != ['different-beads', 'same-beads-new-order', 'same-sequence'] \
                or right != [_relation(d.get('target', ''), other)]:
            errs.append(f'{where}.choices: ids same-sequence / same-beads-new-order / different-beads, the correct one matching the chains')
    elif mode == 'sorter':
        if d.get('bucket') not in SORTER_BUCKETS or not _nonblank(d.get('statement')):
            errs.append(f'{w}: sorter items need a statement and bucket {"/".join(SORTER_BUCKETS)}')
        elif sorted(ids) != sorted(SORTER_BUCKETS) or right != [d['bucket']]:
            errs.append(f'{where}.choices: ids cartoon/real/both, the correct one equal to data.bucket')
        if 'readout' in d:
            if isinstance(d['readout'], dict):
                _check_fragment(d['readout'], 'sequence', f'{w}.readout', 30, errs)
            else:
                errs.append(f'{w}.readout: must be an object')
    elif mode == 'inference':
        if not isinstance(d.get('follows'), bool) or not _nonblank(d.get('statement')):
            errs.append(f'{w}: inference items need a statement and boolean follows')
        elif sorted(ids) != ['does-not-follow', 'follows'] or right != ['follows' if d['follows'] else 'does-not-follow']:
            errs.append(f'{where}.choices: ids follows / does-not-follow, the correct one matching data.follows')
    return errs


def _validate_dispatch_item(item, where):
    """Islet Dispatch: qualitative state + a cell/signal/target triple per choice."""
    d = item.get('data')
    if not isinstance(d, dict):
        return [f'{where}.data: islet-dispatch items need a data object']
    errs, w = [], f'{where}.data'
    if d.get('state') not in ('low', 'elevated'):
        errs.append(f'{w}.state: must be "low" or "elevated"')
    if not _nonblank(d.get('cue')):
        errs.append(f'{w}.cue: missing scenario cue')
    options = d.get('options')
    if not isinstance(options, dict) or len(options) < 3:
        errs.append(f'{w}.options: need at least three dispatch plans')
        return errs
    expected = {'low': ('Alpha cell', 'glucagon', 'liver'),
                'elevated': ('Beta cell', 'insulin', 'many cell types')}
    state = d.get('state')
    if state in expected:
        answer = d.get('answer')
        want = expected[state]
        if options.get(answer) != {'cell': want[0], 'signal': want[1], 'target': want[2]}:
            errs.append(f'{w}.answer: must name the sourced triple for the scenario state')
        for oid, value in options.items():
            if not isinstance(value, dict) or not all(_nonblank(value.get(k)) for k in ('cell', 'signal', 'target')):
                errs.append(f'{w}.options[{oid}]: cell/signal/target must be non-empty text')
    cs = [c for c in item.get('choices', []) if isinstance(c, dict)]
    ids = [c.get('id') for c in cs]
    right = [c.get('id') for c in cs if c.get('correct') is True]
    if sorted(ids) != sorted(options) or right != [d.get('answer')]:
        errs.append(f'{where}.choices: one correct choice matching data.answer, one choice per data.options id')
    return errs


def _validate_relay_item(item, where):
    """Relay Race: main lane is ordered; DPP-4 branch is separate; distractors are labelled."""
    d = item.get('data')
    if not isinstance(d, dict):
        return [f'{where}.data: relay-race items need a data object']
    errs, w = [], f'{where}.data'
    steps, main, branch = d.get('steps'), d.get('main_order'), d.get('branch_ids')
    if not isinstance(steps, dict) or not steps:
        errs.append(f'{w}.steps: need a step map')
        return errs
    if not isinstance(main, list) or not all(isinstance(s, str) for s in main):
        errs.append(f'{w}.main_order: need a list of step ids')
        main = []
    if not isinstance(branch, list) or not all(isinstance(s, str) for s in branch):
        errs.append(f'{w}.branch_ids: need a list of step ids')
        branch = []
    if set(main) & set(branch):
        errs.append(f'{w}: main_order and branch_ids must be disjoint')
    for sid, step in steps.items():
        if not isinstance(step, dict) or not _nonblank(step.get('label')):
            errs.append(f'{w}.steps[{sid}]: need a text label')
        want = 'main' if sid in main else 'branch' if sid in branch else 'distractor'
        if isinstance(step, dict) and step.get('lane') != want:
            errs.append(f'{w}.steps[{sid}].lane: expected {want!r}')
    if not main or not any(sid not in main for sid in steps):
        errs.append(f'{w}: need at least one main step and one branch or distractor step')
    canonical_main, canonical_branch = d.get('main_answer'), d.get('branch_answer')
    if not (isinstance(canonical_main, list) and isinstance(canonical_branch, list)
            and canonical_main == ['meal', 'lcell', 'receptor', 'insulin']
            and canonical_branch == ['dpp4']):
        errs.append(f'{w}: main_answer/branch_answer must be the sourced relay and degradation branch')
    cs = [c for c in item.get('choices', []) if isinstance(c, dict)]
    ids = [c.get('id') for c in cs]
    right = [c.get('id') for c in cs if c.get('correct') is True]
    if d.get('mode') == 'critique':
        if item.get('tier') != 3 or not _nonblank(d.get('gap')):
            errs.append(f'{w}: critique mode requires tier 3 and a non-empty gap')
        if len(right) != 1 or not right[0]:
            errs.append(f'{where}.choices: critique needs exactly one authored careful reply')
        texts = [c.get('text') for c in cs]
        if len(texts) != len(set(texts)):
            errs.append(f'{where}.choices: critique replies must be item-specific and distinct')
    else:
        if item.get('tier') != 3 and main == canonical_main and branch == canonical_branch:
            errs.append(f'{w}: board starts solved; learners must have a move to make')
        if right != ['main-branch'] or 'main-branch' not in ids:
            errs.append(f'{where}.choices: exactly the "main-branch" choice may be correct')
    if 'gap' in d and not _nonblank(d['gap']):
        errs.append(f'{w}.gap: when present, must be non-empty text')
    return errs


ITEM_VALIDATORS = {
    'bead-chain-builder': _validate_bead_item,
    'islet-dispatch': _validate_dispatch_item,
    'relay-race': _validate_relay_item,
}


def validate_game(game, lessons_by_slug: dict, stem: str | None = None) -> list[str]:
    """Return a list of human-readable problems; empty means valid."""
    if not isinstance(game, dict):
        return ['top level: must be a JSON object']
    errs = []
    mode = game.get('review_mode', 'strict')
    if mode not in ('strict', 'flagged'):
        errs.append('review_mode: must be "strict" (default) or "flagged"')
    flagged_ok = mode == 'flagged'
    slug = game.get('game')
    if not (isinstance(slug, str) and SLUG.match(slug)):
        errs.append('game: must be a lowercase-hyphen slug')
    elif stem is not None and stem.lstrip('_') != slug:
        errs.append(f'game: {slug!r} must match the filename ({stem}.json, ignoring a leading "_")')
    for key in ('title', 'summary'):
        if not _nonblank(game.get(key)):
            errs.append(f'{key}: must be non-empty text')
    lesson_slug = game.get('lesson')
    # Only strings can be slugs; an unhashable value ([] / {}) must not raise.
    lesson = lessons_by_slug.get(lesson_slug) if isinstance(lesson_slug, str) else None
    if lesson is None:
        errs.append(f'lesson: {game.get("lesson")!r} is not a lesson slug ({", ".join(sorted(lessons_by_slug))})')
    items = game.get('items')
    if not isinstance(items, list) or not items:
        errs.append('items: need a non-empty list')
        items = []
    seen = set()
    for i, item in enumerate(items):
        errs += _validate_item(item, i, len(lesson['sources']) if lesson else 0)
        extra = ITEM_VALIDATORS.get(slug) if isinstance(slug, str) else None
        if extra and isinstance(item, dict):
            errs += extra(item, f'items[{i}]')
        iid = item.get('id') if isinstance(item, dict) else None
        if isinstance(iid, str):
            if iid in seen:
                errs.append(f'items[{i}].id: duplicate item id {iid!r}')
            seen.add(iid)
        if isinstance(item, dict):
            flagged = item.get('needs_review') is True
            note = item.get('review_note')
            if flagged and flagged_ok and not _nonblank(note):
                errs.append(f'items[{i}].review_note: required non-empty reason when review_mode="flagged"')
            if not flagged and 'review_note' in item:
                errs.append(f'items[{i}].review_note: only needs_review=true items may carry a review note')
    for text in _strings(game):
        for rx, what in ((DOSE, 'dose-like quantity'), (BRANDS, 'drug/brand name')):
            m = rx.search(text)
            if m:
                errs.append(f'safety lint: {what} {m.group(0)!r} in {text[:50]!r} (no dosing or product content)')
    return errs


def validate_dir(games_dir: Path, lessons: list[dict]) -> dict[str, list[str]]:
    """Validate every content/games/*.json (fixtures included). Returns {filename: [errors]}."""
    by_slug = {l['slug']: l for l in lessons}
    problems = {}
    for path in game_files(games_dir):
        try:
            game = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError) as exc:
            problems[path.name] = [f'unreadable JSON: {exc}']
            continue
        errs = validate_game(game, by_slug, path.stem)
        if errs:
            problems[path.name] = errs
    return problems


def publishable_items(game: dict) -> list[dict]:
    """Reviewed items only; flagged mode also publishes needs_review items with a visible banner."""
    if game.get('review_mode') == 'flagged':
        return list(game['items'])
    return [i for i in game['items'] if i['needs_review'] is False]


def public_games(games_dir: Path, lessons: list[dict]) -> list[dict]:
    """Validated, non-fixture games with at least one publishable item, sorted by file name."""
    problems = validate_dir(games_dir, lessons)
    if problems:
        raise ValueError('Invalid game files: ' + '; '.join(f'{f}: {e[0]}' for f, e in problems.items()))
    games = [json.loads(p.read_text(encoding='utf-8')) for p in game_files(games_dir) if not is_fixture(p)]
    return [g for g in games if publishable_items(g)]
