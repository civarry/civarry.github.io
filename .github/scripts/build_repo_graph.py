"""Build repo_graph.json: every public repo embedded with all-MiniLM-L6-v2,
edges = top-3 most similar repos per node by cosine similarity.
The site falls back to token-overlap similarity for repos created after
the last run of this script."""
import json
import os
import urllib.request
from datetime import datetime, timezone

import numpy as np
from sentence_transformers import SentenceTransformer

req = urllib.request.Request(
    'https://api.github.com/users/civarry/repos?per_page=100',
    headers={
        'Authorization': 'Bearer ' + os.environ['GH_PAT'],
        'Accept': 'application/vnd.github+json',
    },
)
raw = json.load(urllib.request.urlopen(req))
repos = [r for r in raw if not r['fork'] and not r.get('private')]

texts = []
for r in repos:
    parts = [r['name'].replace('-', ' ').replace('_', ' ')]
    if r['description']:
        parts.append(r['description'])
    if r.get('topics'):
        parts.append(' '.join(r['topics']))
    if r['language']:
        parts.append(r['language'])
    texts.append('. '.join(parts))

model = SentenceTransformer('all-MiniLM-L6-v2')
emb = model.encode(texts, normalize_embeddings=True)
sim = emb @ emb.T

n = len(repos)
edges = {}
for i in range(n):
    order = np.argsort(-sim[i])
    picked = 0
    for j in order:
        j = int(j)
        if j == i:
            continue
        # Always keep the single best neighbor so no repo is orphaned;
        # further neighbors must clear the similarity floor
        if picked > 0 and sim[i][j] < 0.25:
            break
        key = (min(i, j), max(i, j))
        edges.setdefault(key, round(float(sim[i][j]), 4))
        picked += 1
        if picked == 3:
            break

out = {
    'generated': datetime.now(timezone.utc).isoformat(),
    'repos': [
        {
            'name': r['name'],
            'url': r['html_url'],
            'desc': r['description'] or '',
            'lang': r['language'] or '',
            'topics': r.get('topics', []),
            'stars': r['stargazers_count'],
            'created': int(datetime.fromisoformat(
                r['created_at'].replace('Z', '+00:00')).timestamp() * 1000),
        }
        for r in repos
    ],
    'edges': [{'a': a, 'b': b, 'sim': max(0.0, s)} for (a, b), s in edges.items()],
}

with open('repo_graph.json', 'w') as f:
    json.dump(out, f, separators=(',', ':'))

print(f'{n} repos, {len(out["edges"])} edges')
