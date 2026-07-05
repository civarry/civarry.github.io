"""Audit every public repo against the documentation standard.
Writes repo_health.json, consumed by the /audit Telegram command and the
daily briefing. Archive a repo to exclude it from the audit."""
import json
import os
import re
import urllib.request
from datetime import datetime, timezone

TOKEN = os.environ['GH_PAT']

MIN_DESC = 15      # description at least this many chars
MIN_TOPICS = 3     # at least this many topics
MIN_README = 300   # README visible text at least this many chars


def gh(url, raw=False):
    req = urllib.request.Request(url, headers={
        'Authorization': 'Bearer ' + TOKEN,
        'Accept': 'application/vnd.github.raw+json' if raw else 'application/vnd.github+json',
    })
    try:
        with urllib.request.urlopen(req) as r:
            return r.read().decode('utf-8', 'ignore')
    except Exception:
        return None


def visible_len(md):
    md = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', md)
    md = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', md)
    md = re.sub(r'<[^>]+>', ' ', md)
    md = re.sub(r'```.*?```', ' ', md, flags=re.S)
    md = re.sub(r'\s+', ' ', md)
    return len(md.strip())


repos = json.loads(gh('https://api.github.com/users/civarry/repos?per_page=100'))
repos = [r for r in repos if not r['fork'] and not r.get('private') and not r.get('archived')]

results = []
for r in repos:
    missing = []
    if len((r.get('description') or '').strip()) < MIN_DESC:
        missing.append('description')
    if len(r.get('topics') or []) < MIN_TOPICS:
        missing.append('topics')
    readme = gh(f"https://api.github.com/repos/{r['full_name']}/readme", raw=True)
    if readme is None:
        missing.append('README')
    elif visible_len(readme) < MIN_README:
        missing.append('README too thin')
    results.append({'name': r['name'], 'missing': missing})

results.sort(key=lambda x: (len(x['missing']) == 0, x['name'].lower()))
out = {
    'date': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
    'standard': {
        'description_chars': MIN_DESC,
        'topics': MIN_TOPICS,
        'readme_chars': MIN_README,
    },
    'total': len(results),
    'passing': sum(1 for x in results if not x['missing']),
    'repos': results,
}

with open('repo_health.json', 'w') as f:
    json.dump(out, f, separators=(',', ':'))

print(f"{out['passing']}/{out['total']} repos meet the standard")
for x in results:
    if x['missing']:
        print(f"  {x['name']}: missing {', '.join(x['missing'])}")
