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


def validate_game(game, lessons_by_slug: dict, stem: str | None = None) -> list[str]:
    """Return a list of human-readable problems; empty means valid."""
    if not isinstance(game, dict):
        return ['top level: must be a JSON object']
    errs = []
    slug = game.get('game')
    if not (isinstance(slug, str) and SLUG.match(slug)):
        errs.append('game: must be a lowercase-hyphen slug')
    elif stem is not None and stem.lstrip('_') != slug:
        errs.append(f'game: {slug!r} must match the filename ({stem}.json, ignoring a leading "_")')
    for key in ('title', 'summary'):
        if not _nonblank(game.get(key)):
            errs.append(f'{key}: must be non-empty text')
    lesson = lessons_by_slug.get(game.get('lesson'))
    if lesson is None:
        errs.append(f'lesson: {game.get("lesson")!r} is not a lesson slug ({", ".join(sorted(lessons_by_slug))})')
    items = game.get('items')
    if not isinstance(items, list) or not items:
        errs.append('items: need a non-empty list')
        items = []
    seen = set()
    for i, item in enumerate(items):
        errs += _validate_item(item, i, len(lesson['sources']) if lesson else 0)
        iid = item.get('id') if isinstance(item, dict) else None
        if isinstance(iid, str):
            if iid in seen:
                errs.append(f'items[{i}].id: duplicate item id {iid!r}')
            seen.add(iid)
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
    return [i for i in game['items'] if i['needs_review'] is False]


def public_games(games_dir: Path, lessons: list[dict]) -> list[dict]:
    """Validated, non-fixture games with at least one reviewed item, sorted by file name."""
    problems = validate_dir(games_dir, lessons)
    if problems:
        raise ValueError('Invalid game files: ' + '; '.join(f'{f}: {e[0]}' for f, e in problems.items()))
    games = [json.loads(p.read_text(encoding='utf-8')) for p in game_files(games_dir) if not is_fixture(p)]
    return [g for g in games if publishable_items(g)]
