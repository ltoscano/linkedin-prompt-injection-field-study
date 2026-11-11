"""Merge the analyzer outputs of the LinkedIn search pages into raw_findings.json.

usage: python collect.py <raw_findings.json> <cdp output 1.json> [<cdp output 2.json> ...]

Each input is the JSON printed by `node cdp.mjs <search url> analyze.js`.
The search query is read from the `keywords` parameter of the page URL.
Findings that match at least one semantic rule are kept, deduplicated by
normalized text, and numbered in order of first appearance.

Output: a list of {n, text, queries, rules, channels}. It holds unredacted
text copied from the pages: keep it out of the repository.

NOTE: this script was added during the review of the repository. The original
run assembled the raw findings by hand; the numbering produced here will not
match the one used by the classification table in build_dataset.py.
"""
import json, re, sys
from urllib.parse import urlparse, parse_qs

if len(sys.argv) < 3:
    sys.exit(__doc__)
out_path, inputs = sys.argv[1], sys.argv[2:]
norm = lambda s: re.sub(r'\s+', ' ', s).strip().lower()
found = {}
for path in inputs:
    page = json.load(open(path, encoding='utf-8'))
    query = (parse_qs(urlparse(page.get('url', '')).query).get('keywords') or [''])[0]
    for w in page.get('warnings', []): print(f'{path}: warning: {w}', file=sys.stderr)
    for f in page.get('findings', []):
        text = f.get('decoded') or f.get('text') or ''
        if not f.get('rules') or not text: continue
        rec = found.setdefault(norm(text), dict(n=len(found) + 1, text=text, queries=[], rules=[], channels=[]))
        for key, val in (('queries', [query] if query else []), ('rules', f['rules']), ('channels', [f['channel']])):
            for v in val:
                if v not in rec[key]: rec[key].append(v)
json.dump(list(found.values()), open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(found), 'distinct findings from', len(inputs), 'pages')
