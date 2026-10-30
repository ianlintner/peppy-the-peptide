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
published=[p.name for p in (site/'games'/'data').glob('*')] if (site/'games'/'data').is_dir() else []
assert sorted(published)==sorted(f"{g['game']}.json" for g in public),f'unexpected published game data: {published}'
for game in public:
    page=(site/'lessons'/f"{game['lesson']}.html").read_text()
    assert f'id="game-{game["game"]}"' in page and '<section class="wrap section games" id="games"' in page and '<noscript>' in page,game['game']
    data=json.loads((site/'games'/'data'/f"{game['game']}.json").read_text())
    assert data['items'] and all(i['needs_review'] is False for i in data['items']),game['game']
    assert (site/'games'/game['game']/'main.js').is_file(),f"missing game entry module for {game['game']}"
for lesson in lessons:  # a lesson with no public game must not carry a mount section
    if not any(g['lesson']==lesson['slug'] for g in public):
        assert 'id="games"' not in (site/'lessons'/f"{lesson['slug']}.html").read_text()
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
print(f'PASS: {len(htmls)} pages, {len(lessons)} lesson(s), {len(public)} public game(s), all local links/assets and editorial checks')
