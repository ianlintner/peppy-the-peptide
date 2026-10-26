#!/usr/bin/env python3
"""Render checked editorial JSON into a static course site; no network or model API."""
from __future__ import annotations
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'content'
SITE = ROOT / 'site'
E = html.escape

def load_lessons():
    lessons = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(CONTENT.glob('*.json'))]
    if not lessons:
        raise ValueError('No lessons')
    slugs = [l['slug'] for l in lessons]
    if len(slugs) != len(set(slugs)):
        raise ValueError('Duplicate lesson slug')
    for lesson in lessons:
        assert lesson['number'].isdigit() and lesson['title'] and lesson['objective']
        assert 2 <= len(lesson['panels']) <= 3
        assert set(lesson['depths']) == {'curious', 'college', 'mechanism'}
        assert lesson['sources']
        for panel in lesson['panels']:
            if not (SITE / 'assets' / panel['image']).is_file():
                raise ValueError(f"Missing image: {panel['image']}")
        for source in lesson['sources']:
            if not source['url'].startswith('https://'):
                raise ValueError('Source URL must be HTTPS')
    return lessons

def shell(title, root, body):
    nav = f'<a href="{root}index.html#course">Course</a><a href="{root}index.html#approach">Approach</a><a href="{root}index.html#safety">Safety</a>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Peppy the Peptide: sourced, comic-first science lessons from amino-acid sequence to molecular signaling."><title>{E(title)} · Peppy the Peptide</title><link rel="stylesheet" href="{root}styles.css"></head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="wrap nav"><a class="brand" href="{root}index.html">PEPPY <span>the peptide</span></a><nav aria-label="Main navigation">{nav}</nav></div></header><main id="main">{body}</main><footer class="site-footer">Peppy the Peptide · Educational satire, not medical advice · Original mascot supplied by Ian Lintner · <a href="{root}rights.html">Art rights and disclosure</a></footer></body></html>'''

def render_index(lessons):
    rows=''.join(f'''<li><span class="number">{E(l['number'])}</span><div><h3>{E(l['title'])}</h3><p>{E(l['subtitle'])}</p></div><a href="lessons/{E(l['slug'])}.html">Read lesson →</a></li>''' for l in lessons)
    body=f'''<section class="wrap hero"><div><div class="eyebrow">A comic-first molecular biology classroom</div><h1>Small chain.<br><em>Big character.</em></h1><p class="lede">Follow Peppy from amino-acid chains through hormone signaling and GLP-1. The joke opens the door; sourced explanations carry the lesson.</p><div class="catchphrase">“My personality is sequence-dependent!”</div><div class="actions"><a class="button" href="lessons/{E(lessons[0]['slug'])}.html">Start at lesson 01 ↓</a><a class="button light" href="#course">View course map</a></div></div><div class="cover"><img src="assets/peppy-original.jpg" alt="Peppy, a smiling blue-headed seven-sphere chain in a white lab coat and red sneakers" width="1254" height="1254"></div></section><div class="stripe" aria-hidden="true">SEQUENCE ✦ SHAPE ✦ SIGNAL ✦ EVIDENCE ✦ LIMITS</div><section class="wrap section" id="course"><div class="section-title"><div class="eyebrow">The course</div><h2>One question at a time</h2><p>Each lesson pairs original comic panels with three depths of explanation, a misconception check, and primary sources.</p></div><ol class="course-list">{rows}</ol></section><section class="learning" id="approach"><div class="wrap learning-grid"><div><div class="eyebrow">How to read Peppy</div><h2>Laugh first.<br>Look closer.</h2></div><div><p>At <strong>Curious</strong> depth, learn the central idea. At <strong>College</strong> depth, name the components. At <strong>Mechanism</strong> depth, test where the analogy stops and what evidence a professional would need.</p><p>The images are AI-generated with a consistent Peppy reference. Dialogue, citations, labels and corrections are editable text outside the art. No image on this site is a molecular-structure diagram.</p></div></div></section><section class="science" id="safety"><div class="wrap learning-grid"><div><div class="eyebrow" style="color:var(--gold)">A boundary worth keeping</div><h2>Peppy is not your prescriber.</h2></div><div><p>This is science education and satire, not medical advice, a drug recommendation or a place to buy peptides. Endogenous hormones and manufactured medicines are different subjects. Specific clinical decisions belong with qualified professionals and official drug labeling.</p><p>Detailed treatment comparisons, dosing and claims of efficacy are deliberately out of scope for this MVP. <a href="rights.html">About the art and its rights →</a></p></div></div></section>'''
    (SITE/'index.html').write_text(shell('Course', '', body),encoding='utf-8')

def render_lesson(l, previous, following):
    panels=''.join(f'''<figure class="panel"><img src="../assets/{E(p['image'])}" alt="{E(p['alt'])}" loading="lazy"><figcaption><span class="panel-num">{E(l['number'])} / {E(p['label'])}</span><strong>“{E(p['dialogue'].strip('“”'))}”</strong><small>{E(p['note'])}</small></figcaption></figure>''' for p in l['panels'])
    depth_sections=''.join(f'<div class="depth-pane" id="{key}" data-depth="{key}" {"hidden" if key!="curious" else ""}><h3>{label}</h3>{l["depths"][key]}</div>' for key,label in [('curious','The clean version'),('college','One level deeper'),('mechanism','Mechanism lens')])
    sources=''.join(f'<li><a href="{E(s["url"])}" target="_blank" rel="noopener">{E(s["title"])}</a> — {E(s["note"])}</li>' for s in l['sources'])
    prior=f'<a href="{E(previous["slug"])}.html">← {E(previous["title"])}</a>' if previous else '<a href="../index.html">← Course map</a>'
    nxt=f'<a href="{E(following["slug"])}.html">{E(following["title"])} →</a>' if following else '<a href="../index.html">Back to course map →</a>'
    body=f'''<article><div class="wrap lesson-head"><div class="breadcrumbs"><a href="../index.html">Course</a> / {E(l['number'])}</div><div class="eyebrow">Lesson {E(l['number'])}</div><h1>{E(l['title'])}</h1><p class="lede">{E(l['objective'])}</p></div><div class="wrap"><div class="panel-strip" aria-label="Comic panels in reading order">{panels}</div><section class="depth" aria-label="Explanation depth"><div class="eyebrow">Turn the page deeper</div><h2>What the comic means</h2><div class="depth-controls" role="group" aria-label="Select explanation depth"><button type="button" data-select="curious" aria-pressed="true">Curious</button><button type="button" data-select="college" aria-pressed="false">College</button><button type="button" data-select="mechanism" aria-pressed="false">Mechanism</button></div><div class="depth-copy" aria-live="polite">{depth_sections}</div></section></div><section class="learning"><div class="wrap learning-grid"><div><div class="eyebrow">Where the metaphor stops</div><h2>Beads aren't biology.</h2><p>{E(l['metaphor'])}</p></div><div class="check"><h3>Check your understanding</h3><p>{E(l['check_question'])}</p><details><summary>Reveal answer</summary><p>{E(l['check_answer'])}</p></details></div></div></section><section class="wrap section sources" id="sources"><div class="eyebrow">Source shelf</div><h2>Check the science</h2><ol>{sources}</ol><p class="small">Sources support the biology; comic poses and colored beads are illustrative. Educational content is not medical advice.</p></section><div class="wrap next">{prior}{nxt}</div></article><script src="../lesson.js" defer></script>'''
    (SITE/'lessons'/f"{l['slug']}.html").write_text(shell(l['title'],'../',body),encoding='utf-8')

def main():
    lessons=load_lessons()
    render_index(lessons)
    for i,lesson in enumerate(lessons): render_lesson(lesson,lessons[i-1] if i else None,lessons[i+1] if i+1<len(lessons) else None)
    print(f'Built {len(lessons)} lesson(s) in {SITE}')
if __name__=='__main__': main()
