// ========== Shipped Apps ==========
// To add a new app: just add an object to this array. Nothing else to touch —
// the card (window chrome, tags, tech pills, CTA link) renders automatically.
//
//   name        — app name
//   tag         — short platform label shown top-left, e.g. "macos app", "web app"
//   description — one or two sentences, written for someone deciding whether to try it
//   url         — where to install/open it
//   cta         — link text shown at the bottom of the card, e.g. "Chrome Web Store"
//   tech        — array of tech/stack pills (optional, omit or leave empty)
//   repo        — GitHub repo name (optional) — if set, the card picks up a live
//                 star count and "updated X ago" from the GitHub API, for free
const APPS = [
  {
    name: 'Lasso',
    tag: 'macos app',
    description: 'Circle to Search, but native to the Mac. Hit a hotkey, drag a box around anything on screen, and copy the text out of it, translate it, ask AI about it, or scan a QR code — on-device by default.',
    url: 'https://github.com/civarry/lasso-app',
    cta: 'GitHub',
    tech: ['Swift', 'Apple Intelligence', 'Ollama'],
    repo: 'lasso-app'
  },
  {
    name: 'Proofr',
    tag: 'chrome extension',
    description: 'Private AI proofreading and rewriting from the browser’s right-click menu. Fixes grammar, rewrites tone across nine styles, and translates — on-device by default, no account required.',
    url: 'https://chromewebstore.google.com/detail/proofr-%E2%80%93-private-ai-proof/dfhooimjbdefdbabhppgloclhkjolhfg',
    cta: 'Chrome Web Store',
    tech: ['Chrome Extension', 'On-device AI']
  },
  {
    name: 'TW Bus',
    tag: 'web app',
    description: 'Real-time bus trip planning in Taiwan — live location paired with route lookup by bus number, sorting by fewest stops or soonest ETA, and an AI copilot that answers questions about your results.',
    url: 'https://tw-bus.vercel.app/',
    cta: 'Open App',
    tech: ['Next.js', 'AI']
  },
  {
    name: 'Remit Compare',
    tag: 'web app',
    description: 'Compares the real cost of sending NTD to PHP across remittance channels — fees and spreads side by side against the mid-market rate, so you know what actually arrives.',
    url: 'https://remitly-seven.vercel.app/',
    cta: 'Open App',
    tech: ['Next.js']
  }
];

(function renderApps() {
  const grid = document.getElementById('apps-grid');
  if (!grid) return;

  const closeSvg = '<svg viewBox="0 0 8 8" fill="none"><path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor"/></svg>';
  const minSvg = '<svg viewBox="0 0 8 8" fill="none"><path d="M1 4h6" stroke="currentColor"/></svg>';
  const restoreSvg = '<svg viewBox="0 0 8 8" fill="none"><path d="M1 6.5L4 1.5l3 5" stroke="currentColor" stroke-linejoin="round"/></svg>';
  const linkSvg = '<svg class="project-link-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  const arrowSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';

  grid.innerHTML = APPS.map((app, i) => {
    const tech = (app.tech && app.tech.length)
      ? '<div class="project-tech">' + app.tech.map(t => '<span>' + t + '</span>').join('') + '</div>'
      : '';
    const repoAttr = app.repo ? ' data-repo="' + app.repo + '"' : '';

    return (
      '<a href="' + app.url + '" target="_blank" rel="noopener noreferrer" class="project-card fade-in delay-' + ((i % 4) + 1) + '"' + repoAttr + '>' +
        '<div class="window-bar">' +
          '<span class="wdot wdot-red">' + closeSvg + '</span>' +
          '<span class="wdot wdot-yellow">' + minSvg + '</span>' +
          '<span class="wdot wdot-green">' + restoreSvg + '</span>' +
        '</div>' +
        '<div class="project-header">' +
          '<div class="project-tag">' + app.tag + '</div>' +
          linkSvg +
        '</div>' +
        '<h3>' + app.name + '</h3>' +
        '<p>' + app.description + '</p>' +
        '<div class="project-meta"></div>' +
        tech +
        '<div class="app-cta">' + app.cta + ' ' + arrowSvg + '</div>' +
      '</a>'
    );
  }).join('');

  loadLiveStats();
})();

// Live star count + last-updated for any card with a data-repo attribute.
// Self-contained (doesn't depend on the portfolio's app.js) so this file
// works standalone on the /apps/ page.
async function loadLiveStats() {
  const cards = document.querySelectorAll('.project-card[data-repo]');
  if (!cards.length) return;

  const CACHE_KEY = 'repo_stats_v1';
  const CACHE_TTL = 3600000; // 1 hour

  function timeAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    const months = Math.floor(days / 30);
    if (months < 12) return months + ' month' + (months > 1 ? 's' : '') + ' ago';
    const years = Math.floor(months / 12);
    return years + ' year' + (years > 1 ? 's' : '') + ' ago';
  }

  let stats = null;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL) stats = cached.data;
  } catch { /* ignore corrupt cache */ }

  if (!stats) {
    try {
      const res = await fetch('https://api.github.com/users/civarry/repos?per_page=100');
      if (!res.ok) return;
      const repos = await res.json();
      stats = {};
      repos.forEach(r => { stats[r.name] = { stars: r.stargazers_count, pushed: r.pushed_at }; });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: stats })); } catch { /* full/unavailable */ }
    } catch { return; }
  }

  cards.forEach(card => {
    const info = stats[card.dataset.repo];
    const meta = card.querySelector('.project-meta');
    if (!info || !meta) return;
    const parts = [];
    if (info.stars > 0) parts.push('<span><span class="meta-star">★</span> ' + info.stars + '</span>');
    parts.push('<span>updated ' + timeAgo(info.pushed) + '</span>');
    meta.innerHTML = parts.join('<span>·</span>');
  });
}
