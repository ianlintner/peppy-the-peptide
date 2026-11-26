#!/usr/bin/env python3
"""Static course smoke tests: routes, links, assets, editorial invariants."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib, json, re, sys
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'scripts'))
import games_data
site=root/'site'
class Links(HTMLParser):
    def __init__(self): super().__init__();self.urls=[];self.images=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        for k in ('href','src'):
            if k in d:self.urls.append((tag,k,d[k]))
        if tag=='img':self.images.append(d)
lessons=[json.loads(p.read_text()) for p in sorted((root/'content').glob('*.json'))]
assert len(lessons)>=1
htmls=[site/'index.html',site/'rights.html',site/'games'/'index.html']+[site/'lessons'/f"{x['slug']}.html" for x in lessons]
for page in htmls:
    assert page.is_file(),page
    text=page.read_text()
    parser=Links();parser.feed(text)
    for tag,key,url in parser.urls:
        if url.startswith(('https://','#','mailto:')):continue
        target=(page.parent/url.split('#')[0]).resolve()
        assert target.is_relative_to(site.resolve()),(page,url)
        assert target.is_file(),(page,url)
    assert all(len(i.get('alt','').strip()) >= 25 for i in parser.images),page
    assert 'href="#main"' in text and 'id="main"' in text,page
    assert 'FAL_KEY' not in text and 'sk-' not in text,page
    assert '<meta name="viewport"' in text,page
for lesson in lessons:
    text=(site/'lessons'/f"{lesson['slug']}.html").read_text()
    assert text.count('class="panel"')==len(lesson['panels'])
    assert 'data-select="curious"' in text and 'data-select="mechanism"' in text
    assert 'Check your understanding' in text and 'Where the metaphor stops' in text
    assert len(lesson['sources'])>=1
assert (site/'styles.css').stat().st_size<100_000
assert all(p.stat().st_size<500_000 for p in (site/'assets').glob('*.webp'))

# --- games: item schema (content/games/SCHEMA.md), mount points, vendored files, size ceilings ---
problems=games_data.validate_dir(root/'content'/'games',lessons)
if problems:
    for fname,errs in problems.items():
        for err in errs:print(f'FAIL content/games/{fname}: {err}',file=sys.stderr)
    raise SystemExit(f'{sum(map(len,problems.values()))} game content problem(s)')
public=games_data.public_games(root/'content'/'games',lessons)
assert (site/'games'/'index.html').is_file()
published=[p.name for p in (site/'games'/'data').glob('*.json') if p.name!='manifest.json'] if (site/'games'/'data').is_dir() else []
assert sorted(published)==sorted(f"{g['game']}.json" for g in public),f'unexpected published game data: {published}'
for game in public:
    page=(site/'lessons'/f"{game['lesson']}.html").read_text()
    assert f'id="game-{game["game"]}"' in page and '<section class="wrap section games" id="games"' in page and '<noscript>' in page,game['game']
    data=json.loads((site/'games'/'data'/f"{game['game']}.json").read_text())
    assert data['items'],f"{game['game']}: no published items"
    flagged_mode = game.get('review_mode') == 'flagged'
    assert data.get('review_mode') == game.get('review_mode'),f"{game['game']}: published review_mode mismatch"
    if flagged_mode:
        # The card's Tier 3 items stay flagged for clinical review but are playable behind a banner.
        assert all(i.get('review_note','').strip() for i in data['items'] if i['needs_review'] is True),f"{game['game']}: flagged item missing review note"
        assert any(i['needs_review'] is True for i in data['items']),f"{game['game']}: flagged mode set but no flagged item"
    else:
        assert all(i['needs_review'] is False for i in data['items']),game['game']
    assert (site/'games'/game['game']/'main.js').is_file(),f"missing game entry module for {game['game']}"
for lesson in lessons:  # a lesson with no public game must not carry a mount section
    if not any(g['lesson']==lesson['slug'] for g in public):
        assert 'id="games"' not in (site/'lessons'/f"{lesson['slug']}.html").read_text()
# --- games hub + Daily Review: nav, manifest, progress mount points, module entries ---
for page in htmls:
    text=page.read_text()
    if page.name != 'review.html':
        assert 'href="../games/review.html"' in text or 'href="games/review.html"' in text or 'href="review.html"' in text, f'{page}: missing Daily Review nav'
assert 'data-game-progress=' in (site/'index.html').read_text(), 'course map lacks per-lesson game progress mount'
hub=(site/'games'/'index.html').read_text()
assert 'href="review.html"' in hub and 'data-mastery=' in hub and 'src="hub.js"' in hub
review=(site/'games'/'review.html').read_text()
for needed in ('id="review-mount"','id="review-export"','id="review-import"','id="review-reset"','src="review.js"','aria-live="polite"'):
    assert needed in review, f'review.html missing {needed}'
manifest=json.loads((site/'games'/'data'/'manifest.json').read_text())
assert {l['slug'] for l in manifest['lessons']}=={l['slug'] for l in lessons}
assert {g['game'] for g in manifest['games']}=={g['game'] for g in public}
for rel in ('hub.js','review.js','ui/review-ui.js'):
    assert (site/'games'/rel).is_file(),f'missing {rel}'
# vendored Preact/hooks/htm: hashes pinned in ARCHITECTURE.md, license files kept
arch=(root/'ARCHITECTURE.md').read_text()
for rel in ('preact/preact.mjs','preact/hooks.mjs','htm/htm.mjs'):
    digest=hashlib.sha256((site/'vendor'/rel).read_bytes()).hexdigest()
    assert f'`{digest}`' in arch,f'vendor hash for {rel} not pinned in ARCHITECTURE.md'
assert all((site/'vendor'/d/'LICENSE').is_file() for d in ('preact','htm'))
# file-size ceiling from ARCHITECTURE.md: hand-written JS/CSS under site/games stays <= 400 lines
for p in (site/'games').rglob('*'):
    if p.suffix in ('.js','.mjs','.css') and p.relative_to(site/'games').parts[0]!='data':
        assert len(p.read_text().splitlines())<=400,f'{p.relative_to(root)} exceeds the 400-line ceiling'
# --- Peppy SVG: seven spheres, six states, size budget; dev gallery stays unlinked ---
peppy=(site/'assets'/'peppy.svg').read_text()
assert peppy.count('<g class="peppy-sphere"')==7,'peppy.svg must have exactly seven spheres'
for state in ('idle','wink','thinking','oops','cheer','point'):
    assert f'<g class="peppy-pose" data-state="{state}"' in peppy,f'peppy.svg missing state {state}'
assert len(peppy.encode())<12*1024,'peppy.svg must stay under 12 KB'
assert 'http' not in peppy.replace('http://www.w3.org/2000/svg',''),'peppy.svg must not reference the network'
gallery=site/'dev'/'peppy-gallery.html'
assert gallery.is_file()
for page in site.rglob('*.html'):
    if page!=gallery:assert 'peppy-gallery' not in page.read_text(),f'{page} links the dev gallery'
assert not list(site.glob('sitemap*')),'dev gallery must not appear in a sitemap'
# --- no runtime network: only <a href> may point off-site; CSS/JS reference no URL but XML namespaces ---
XMLNS=re.compile(r'http://www\.w3\.org/[0-9]{4}/[A-Za-z/]+')
for page in site.rglob('*.html'):
    parser=Links();parser.feed(page.read_text())
    for tag,key,url in parser.urls:
        assert tag=='a' or not re.match(r'(https?:)?//',url),f'{page.relative_to(root)}: <{tag} {key}> loads {url} at runtime'
for p in site.rglob('*'):
    if p.suffix in ('.css','.js','.mjs') and '__tests__' not in p.parts:
        code=XMLNS.sub('',p.read_text())
        assert not re.search(r'https?://\w|url\(\s*["\']?//|@import\s+(url|["\'])',code),f'{p.relative_to(root)} references a network URL'
assert all((site/'fonts'/f).is_file() for f in ('dm-sans-latin.woff2','fredoka-latin.woff2','OFL-DMSans.txt','OFL-Fredoka.txt')),'self-hosted fonts or their OFL texts missing'
# --- clinical content-review pack stays in lockstep with every needs_review item ---
import content_review
assert content_review.OUT.read_text(encoding='utf-8')==content_review.render(),'docs/game-content-review.md is stale: run python scripts/content_review.py'
print(f'PASS: {len(htmls)} pages, {len(lessons)} lesson(s), {len(public)} public game(s), all local links/assets and editorial checks')
