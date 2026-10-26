#!/usr/bin/env python3
"""Static course smoke tests: routes, links, assets, editorial invariants."""
from html.parser import HTMLParser
from pathlib import Path
import json, re
root=Path(__file__).resolve().parents[1]
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
htmls=[site/'index.html',site/'rights.html']+[site/'lessons'/f"{x['slug']}.html" for x in lessons]
for page in htmls:
    assert page.is_file(),page
    text=page.read_text()
    parser=Links();parser.feed(text)
    for tag,key,url in parser.urls:
        if url.startswith(('https://','#','mailto:')):continue
        target=(page.parent/url.split('#')[0]).resolve()
        assert target.is_relative_to(site.resolve()),(page,url)
        assert target.is_file(),(page,url)
    assert all(i.get('alt') is not None for i in parser.images),page
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
print(f'PASS: {len(htmls)} pages, {len(lessons)} lesson(s), all local links/assets and editorial checks')
