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
        for bad in ([], {}, None, 3):
            with self.subTest(lesson=bad):
                game = copy.deepcopy(EXAMPLE)
                game['lesson'] = bad
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
            odd = copy.deepcopy(EXAMPLE)
            odd['game'] = 'odd-lesson'
            odd['lesson'] = []  # unhashable: must be a diagnostic, not a crash
            (Path(tmp) / 'odd-lesson.json').write_text(json.dumps(odd))
            problems = gd.validate_dir(Path(tmp), LESSONS)
            self.assertEqual(sorted(problems), ['broken.json', 'garbled.json', 'odd-lesson.json'])
            self.assertTrue(any('not a lesson slug' in e for e in problems['odd-lesson.json']))
            with self.assertRaises(ValueError):
                gd.public_games(Path(tmp), LESSONS)


class BuildGating(unittest.TestCase):
    def test_needs_review_items_are_held_out(self):
        game = copy.deepcopy(EXAMPLE)
        game['items'][0]['needs_review'] = True
        self.assertEqual(len(gd.publishable_items(game)), len(EXAMPLE['items']) - 1)

    def test_strict_mode_rejects_review_note_and_bad_mode(self):
        game = copy.deepcopy(EXAMPLE)
        game['items'][0]['review_note'] = 'check later'
        self.assertIn('review_note', errors(game)[0])
        game = copy.deepcopy(EXAMPLE)
        game['review_mode'] = 'whenever'
        self.assertTrue(any('review_mode' in e for e in errors(game)))

    def test_flagged_mode_publishes_with_notes(self):
        game = copy.deepcopy(EXAMPLE)
        game['review_mode'] = 'flagged'
        game['items'][0]['needs_review'] = True
        self.assertTrue(any('review_note' in e for e in errors(game)))  # note is required
        game['items'][0]['review_note'] = 'Awaiting clinical review of the evidence-gap wording.'
        self.assertEqual(errors(game), [])
        self.assertEqual(len(gd.publishable_items(game)), len(EXAMPLE['items']))
        self.assertEqual(all(i['needs_review'] for i in game['items'][:1]), True)


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


BEAD = json.loads((ROOT / 'content' / 'games' / 'bead-chain-builder.json').read_text(encoding='utf-8'))


class BeadChainRules(unittest.TestCase):
    def bead_errors(self, fn, item_id):
        game = copy.deepcopy(BEAD)
        fn(next(i for i in game['items'] if i['id'] == item_id))
        return gd.validate_game(game, BY_SLUG, 'bead-chain-builder')

    def assertBead(self, fn, item_id, fragment):
        errs = self.bead_errors(fn, item_id)
        self.assertTrue(any(fragment in e for e in errs), f'expected {fragment!r} in {errs}')

    def test_shipped_game_is_valid_and_public(self):
        self.assertEqual(gd.validate_game(BEAD, BY_SLUG, 'bead-chain-builder'), [])
        self.assertIn('bead-chain-builder', [g['game'] for g in gd.public_games(ROOT / 'content' / 'games', LESSONS)])
        tiers = [i['tier'] for i in BEAD['items']]
        self.assertTrue(all(tiers.count(t) >= 6 for t in (1, 2, 3)))

    def test_lesson_sources_list_uniprot_records(self):
        urls = [s['url'] for s in BY_SLUG['foundations']['sources']]
        self.assertIn('https://www.uniprot.org/uniprotkb/P01275/entry', urls)
        self.assertIn('https://www.uniprot.org/uniprotkb/P01308/entry', urls)
        self.assertEqual(urls[0], 'https://www.genome.gov/genetics-glossary/Peptide')

    def test_unverified_or_mismatched_residues_rejected(self):
        self.assertBead(lambda i: i['data'].__setitem__('target', 'HAEGTFS'), 'build-glp1-start', 'not a verified UniProt')
        self.assertBead(lambda i: i['data'].__setitem__('residues', '98-103'), 'build-glp1-start', 'does not match the length')
        self.assertBead(lambda i: i['data'].__setitem__('accession', 'P01308'), 'build-glp1-start', 'not a verified UniProt')

    def test_missing_provenance_or_bad_residue_letters_rejected(self):
        self.assertBead(lambda i: i['data'].pop('accession'), 'build-glp1-start', 'accession')
        self.assertBead(lambda i: i['data'].__setitem__('target', 'HAEGTFB'), 'build-glp1-start', 'standard residues')

    def test_unknown_mode_or_view_rejected(self):
        self.assertBead(lambda i: i['data'].__setitem__('mode', 'dance'), 'build-glp1-start', 'data.mode')
        self.assertBead(lambda i: i['data'].__setitem__('view', 'x-ray'), 'build-glp1-start', 'data.view')
        self.assertBead(lambda i: i.pop('data'), 'build-glp1-start', 'data object')

    def test_spot_correct_chain_must_be_the_reordered_one(self):
        def swap(i):
            for c in i['choices']:
                c['correct'] = c['id'] == 'a'
                c.setdefault('feedback', 'x')
        self.assertBead(swap, 'spot-glp1-swap', 'only same-beads-new-order')

    def test_compare_inference_sorter_answers_must_match_data(self):
        self.assertBead(lambda i: i['data'].__setitem__('other', 'GIVEQCS'), 'compare-reordered', 'matching the chains')
        self.assertBead(lambda i: i['data'].__setitem__('follows', True), 'inf-glp1-activity', 'matching data.follows')
        self.assertBead(lambda i: i['data'].__setitem__('bucket', 'real'), 'cc-beads-round', 'equal to data.bucket')

    def test_readout_must_be_verified(self):
        self.assertBead(lambda i: i['data']['readout'].__setitem__('sequence', 'HAEGTFTSDVSSYLEGQAAKEFIAWLVKGG'), 'cc-direction-readout', 'readout')


DISPATCH = json.loads((ROOT / 'content' / 'games' / 'islet-dispatch.json').read_text(encoding='utf-8'))
RELAY = json.loads((ROOT / 'content' / 'games' / 'relay-race.json').read_text(encoding='utf-8'))


class IsletDispatchRules(unittest.TestCase):
    def dispatch_errors(self, fn, item_id):
        game = copy.deepcopy(DISPATCH)
        fn(next(i for i in game['items'] if i['id'] == item_id))
        return gd.validate_game(game, BY_SLUG, 'islet-dispatch')

    def assertDispatch(self, fn, item_id, fragment):
        errs = self.dispatch_errors(fn, item_id)
        self.assertTrue(any(fragment in e for e in errs), f'expected {fragment!r} in {errs}')

    def test_shipped_game_is_valid_and_public(self):
        self.assertEqual(gd.validate_game(DISPATCH, BY_SLUG, 'islet-dispatch'), [])
        self.assertIn('islet-dispatch', [g['game'] for g in gd.public_games(ROOT / 'content' / 'games', LESSONS)])
        tiers = [i['tier'] for i in DISPATCH['items']]
        self.assertTrue(all(tiers.count(t) >= 6 for t in (1, 2, 3)))

    def test_state_and_cue_required(self):
        self.assertDispatch(lambda i: i['data'].__setitem__('state', 'normal'), 't1-after-meal', 'data.state')
        self.assertDispatch(lambda i: i['data'].pop('cue'), 't1-after-meal', 'data.cue')

    def test_answer_must_match_qualitative_state(self):
        def swap(i):
            i['data']['state'] = 'low'
        self.assertDispatch(swap, 't1-after-meal', 'data.answer')
        def unknown(i):
            i['data']['answer'] = 'made-up'
        self.assertDispatch(unknown, 't1-after-meal', 'data.answer')

    def test_options_and_choices_must_agree(self):
        self.assertDispatch(lambda i: i['data']['options'].pop('beta-insulin-liver-only'), 't1-after-meal', 'choices')
        self.assertDispatch(lambda i: i['data']['options']['beta-insulin-many-cells'].__setitem__('signal', ''),
                            't1-after-meal', 'options')


class RelayRaceRules(unittest.TestCase):
    def relay_errors(self, fn, item_id):
        game = copy.deepcopy(RELAY)
        fn(next(i for i in game['items'] if i['id'] == item_id))
        return gd.validate_game(game, BY_SLUG, 'relay-race')

    def assertRelay(self, fn, item_id, fragment):
        errs = self.relay_errors(fn, item_id)
        self.assertTrue(any(fragment in e for e in errs), f'expected {fragment!r} in {errs}')

    def test_shipped_game_is_valid_and_public(self):
        self.assertEqual(gd.validate_game(RELAY, BY_SLUG, 'relay-race'), [])
        self.assertIn('relay-race', [g['game'] for g in gd.public_games(ROOT / 'content' / 'games', LESSONS)])
        tiers = [i['tier'] for i in RELAY['items']]
        self.assertTrue(all(tiers.count(t) >= 6 for t in (1, 2, 3)))

    def test_lanes_must_be_disjoint_and_labels_must_match(self):
        def overlap(i):
            i['data']['branch_ids'].append('meal')
        self.assertRelay(overlap, 't1-relay-order', 'disjoint')
        self.assertRelay(lambda i: i['data']['steps']['meal'].__setitem__('lane', 'branch'),
                         't1-relay-order', 'expected')
        self.assertRelay(lambda i: i['data']['steps']['dpp4'].pop('label'), 't1-relay-order', 'label')

    def test_insert_item_can_start_with_empty_branch_but_needs_a_distractor(self):
        # repair items deliberately start with DPP-4 in the distractor tray
        self.assertEqual(self.relay_errors(lambda i: None, 't2-insert-branch'), [])
        self.assertRelay(lambda i: i['data']['steps'].pop('dpp4'), 't2-insert-branch', 'branch or distractor')

    def test_only_main_branch_choice_may_be_correct(self):
        def flip(i):
            right = next(c for c in i['choices'] if c['correct'])
            other = next(c for c in i['choices'] if not c['correct'])
            right['correct'] = False
            right['feedback'] = 'not this one'
            other['correct'] = True
        self.assertRelay(flip, 't1-relay-order', 'main-branch')


if __name__ == '__main__':
    unittest.main()
