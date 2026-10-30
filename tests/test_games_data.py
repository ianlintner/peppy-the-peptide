"""Validator tests for content/games/*.json. Run: python -m unittest discover -s tests"""
import copy, json, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import games_data as gd  # noqa: E402

LESSONS = [json.loads(p.read_text(encoding='utf-8')) for p in sorted((ROOT / 'content').glob('*.json'))]
BY_SLUG = {l['slug']: l for l in LESSONS}
EXAMPLE = json.loads((ROOT / 'content' / 'games' / '_example.json').read_text(encoding='utf-8'))


def errors(game):
    return gd.validate_game(game, BY_SLUG, 'example')


def mutated(fn, item=0):
    game = copy.deepcopy(EXAMPLE)
    fn(game['items'][item])
    return game


class ValidExamples(unittest.TestCase):
    def test_example_fixture_is_valid(self):
        self.assertEqual(errors(EXAMPLE), [])

    def test_fixture_is_not_public(self):
        self.assertTrue(gd.is_fixture(ROOT / 'content' / 'games' / '_example.json'))
        self.assertEqual([g['game'] for g in gd.public_games(ROOT / 'content' / 'games', LESSONS) if g['game'] == 'example'], [])

    def test_every_committed_game_file_is_valid(self):
        self.assertEqual(gd.validate_dir(ROOT / 'content' / 'games', LESSONS), {})


class RejectsViolations(unittest.TestCase):
    def assertRejects(self, game, fragment):
        errs = errors(game)
        self.assertTrue(any(fragment in e for e in errs), f'expected {fragment!r} in {errs}')

    def test_missing_tier(self):
        self.assertRejects(mutated(lambda i: i.pop('tier')), '.tier')

    def test_tier_out_of_range_or_wrong_type(self):
        for bad in (0, 4, '1', 1.0, True, None):
            with self.subTest(tier=bad):
                self.assertRejects(mutated(lambda i, b=bad: i.__setitem__('tier', b)), '.tier')

    def test_missing_or_blank_misconception(self):
        self.assertRejects(mutated(lambda i: i.pop('misconception')), '.misconception')
        self.assertRejects(mutated(lambda i: i.__setitem__('misconception', '   ')), '.misconception')

    def test_missing_source(self):
        self.assertRejects(mutated(lambda i: i.pop('source_ids')), '.source_ids')
        self.assertRejects(mutated(lambda i: i.__setitem__('source_ids', [])), '.source_ids')

    def test_unknown_source_id(self):
        n = len(BY_SLUG['foundations']['sources'])
        self.assertRejects(mutated(lambda i: i.__setitem__('source_ids', [n + 1])), 'not in the lesson sources')
        self.assertRejects(mutated(lambda i: i.__setitem__('source_ids', [0])), 'not in the lesson sources')

    def test_non_integer_or_duplicate_source_ids(self):
        self.assertRejects(mutated(lambda i: i.__setitem__('source_ids', ['1'])), 'unique integers')
        self.assertRejects(mutated(lambda i: i.__setitem__('source_ids', [1, 1])), 'unique integers')

    def test_missing_distractor_feedback(self):
        def drop(item):
            next(c for c in item['choices'] if not c['correct']).pop('feedback')
        self.assertRejects(mutated(drop), 'feedback')

    def test_blank_distractor_feedback(self):
        def blank(item):
            next(c for c in item['choices'] if not c['correct'])['feedback'] = ' '
        self.assertRejects(mutated(blank), 'feedback')

    def test_short_hint_ladder_for_tier_1_and_2(self):
        for tier, idx in ((1, 0), (2, 1)):
            with self.subTest(tier=tier):
                self.assertRejects(mutated(lambda i: i.__setitem__('hint_ladder', ['only one']), idx), 'at least 2 hints')
                self.assertRejects(mutated(lambda i: i.pop('hint_ladder'), idx), 'at least 2 hints')

    def test_tier_3_may_have_no_hints(self):
        self.assertEqual(errors(mutated(lambda i: i.__setitem__('hint_ladder', []), 2)), [])

    def test_needs_review_must_be_boolean(self):
        for bad in ('false', 0, None):
            with self.subTest(value=bad):
                self.assertRejects(mutated(lambda i, b=bad: i.__setitem__('needs_review', b)), 'needs_review')
        self.assertRejects(mutated(lambda i: i.pop('needs_review')), 'needs_review')

    def test_exactly_one_correct_choice(self):
        def none_correct(item):
            for c in item['choices']:
                c['correct'] = False
                c.setdefault('feedback', 'x')
        self.assertRejects(mutated(none_correct), 'exactly one choice')
        def two_correct(item):
            for c in item['choices'][:2]:
                c['correct'] = True
        self.assertRejects(mutated(two_correct), 'exactly one choice')

    def test_unknown_lesson_and_filename_mismatch(self):
        game = copy.deepcopy(EXAMPLE)
        game['lesson'] = 'nope'
        self.assertRejects(game, 'not a lesson slug')
        game = copy.deepcopy(EXAMPLE)
        game['game'] = 'other'
        self.assertRejects(game, 'must match the filename')

    def test_duplicate_item_ids(self):
        game = copy.deepcopy(EXAMPLE)
        game['items'][1]['id'] = game['items'][0]['id']
        self.assertRejects(game, 'duplicate item id')

    def test_empty_items(self):
        game = copy.deepcopy(EXAMPLE)
        game['items'] = []
        self.assertRejects(game, 'items')

    def test_safety_lint_blocks_dose_and_brand_text(self):
        self.assertRejects(mutated(lambda i: i.__setitem__('explanation', 'Take 5 mg daily.')), 'safety lint')
        self.assertRejects(mutated(lambda i: i.__setitem__('prompt', 'Is Ozempic better?')), 'safety lint')
        self.assertRejects(mutated(lambda i: i['choices'][1].__setitem__('feedback', 'about 10 units')), 'safety lint')


class DirectoryValidation(unittest.TestCase):
    def test_validate_dir_reports_per_file(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            bad = copy.deepcopy(EXAMPLE)
            bad['game'] = 'broken'
            del bad['items'][0]['tier']
            (Path(tmp) / 'broken.json').write_text(json.dumps(bad))
            (Path(tmp) / 'garbled.json').write_text('{nope')
            problems = gd.validate_dir(Path(tmp), LESSONS)
            self.assertEqual(sorted(problems), ['broken.json', 'garbled.json'])
            with self.assertRaises(ValueError):
                gd.public_games(Path(tmp), LESSONS)


class BuildGating(unittest.TestCase):
    def test_needs_review_items_are_held_out(self):
        game = copy.deepcopy(EXAMPLE)
        game['items'][0]['needs_review'] = True
        self.assertEqual(len(gd.publishable_items(game)), len(EXAMPLE['items']) - 1)


class BuildMountPoint(unittest.TestCase):
    def setUp(self):
        import build
        self.build = build

    def test_no_public_game_means_no_markup(self):
        self.assertEqual(self.build.render_games_section(BY_SLUG['foundations'], []), ('', ''))

    def test_mount_point_has_noscript_fallback_and_module_script(self):
        game = dict(EXAMPLE, items=gd.publishable_items(EXAMPLE))
        section, scripts = self.build.render_games_section(BY_SLUG['foundations'], [game])
        self.assertIn('id="games"', section)
        self.assertIn('id="game-example"', section)
        self.assertIn('<noscript>', section)
        self.assertIn('../games/example/main.js', scripts)
        self.assertEqual(self.build.render_games_section(BY_SLUG['signal-cast'], [game]), ('', ''))


if __name__ == '__main__':
    unittest.main()
