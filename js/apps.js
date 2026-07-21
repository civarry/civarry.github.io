// ========== Shipped Apps ==========
// To add a new app: just add an object to this array. Nothing else to touch —
// the tile, icon, and detail popup render automatically.
//
//   name        — app name
//   icon        — path to a square icon (put the file in apps/icons/)
//   tag         — short platform label, e.g. "macos app", "web app"
//   description — one or two sentences, shown when the tile is tapped
//   url         — where to install/open it
//   cta         — button text in the detail popup, e.g. "Chrome Web Store"
//   tech        — array of tech/stack pills (optional, omit or leave empty)
//   repo        — GitHub repo name (optional) — if set, the popup picks up a
//                 live star count and "updated X ago" from the GitHub API
const APPS = [
  {
    name: 'Lasso',
    icon: 'icons/lasso.png',
    tag: 'macos app',
    description: 'Circle to Search, but native to the Mac. Hit a hotkey, drag a box around anything on screen, and copy the text out of it, translate it, ask AI about it, or scan a QR code — on-device by default.',
    url: 'https://github.com/civarry/lasso-app',
    cta: 'GitHub',
    tech: ['Swift', 'Apple Intelligence', 'Ollama'],
    repo: 'lasso-app'
  },
  {
    name: 'Proofr',
    icon: 'icons/proofr.png',
    tag: 'chrome extension',
    description: 'Private AI proofreading and rewriting from the browser’s right-click menu. Fixes grammar, rewrites tone across nine styles, and translates — on-device by default, no account required.',
    url: 'https://chromewebstore.google.com/detail/proofr-%E2%80%93-private-ai-proof/dfhooimjbdefdbabhppgloclhkjolhfg',
    cta: 'Chrome Web Store',
    tech: ['Chrome Extension', 'On-device AI']
  },
  {
    name: 'TW Bus',
    icon: 'icons/tw-bus.png',
    tag: 'web app',
    description: 'Real-time bus trip planning in Taiwan — live location paired with route lookup by bus number, sorting by fewest stops or soonest ETA, and an AI copilot that answers questions about your results.',
    url: 'https://tw-bus.vercel.app/',
    cta: 'Open App',
    tech: ['Next.js', 'AI']
  },
  {
    name: 'Remit Compare',
    icon: 'icons/remit-compare.png',
    tag: 'web app',
    description: 'Compares the real cost of sending NTD to PHP across remittance channels — fees and spreads side by side against the mid-market rate, so you know what actually arrives.',
    url: 'https://remitly-seven.vercel.app/',
    cta: 'Open App',
    tech: ['Next.js']
  },
  {
    name: 'MotionCast',
    icon: 'icons/motioncast.png',
    tag: 'web app',
    description: 'Turns a phone into a real-time motion source for any computer — orientation, gyro, and two-way haptics stream over a local HTTPS + WebSocket link. Scan a QR code to pair, then use the live sensor data or the built-in tilt-controlled ball game.',
    url: 'https://motioncast.onrender.com',
    cta: 'Open App',
    tech: ['JavaScript', 'WebSocket', 'PWA'],
    repo: 'motioncast'
  }
];

(function initAppsStore() {
  const grid = document.getElementById('apps-grid');
  if (!grid) return;

  // ---------- Tile grid ----------
  grid.innerHTML = APPS.map((app, i) =>
    '<button type="button" class="app-tile fade-in delay-' + ((i % 4) + 1) + '" data-index="' + i + '">' +
      '<img class="app-tile-icon" src="' + app.icon + '" alt="" loading="lazy" width="72" height="72">' +
      '<span class="app-tile-name">' + app.name + '</span>' +
      '<span class="app-tile-tag">' + app.tag + '</span>' +
    '</button>'
  ).join('');

  // ---------- Detail modal (single instance, populated on open) ----------
  const backdrop = document.createElement('div');
  backdrop.className = 'app-modal-backdrop';
  backdrop.id = 'app-modal-backdrop';
  backdrop.innerHTML =
    '<div class="app-modal" role="dialog" aria-modal="true" aria-labelledby="app-modal-name">' +
      '<button type="button" class="app-modal-close" aria-label="Close">' +
        '<svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<div class="app-modal-header">' +
        '<img class="app-modal-icon" id="app-modal-icon" src="" alt="" width="64" height="64">' +
        '<div class="app-modal-title">' +
          '<h3 id="app-modal-name"></h3>' +
          '<div class="project-tag" id="app-modal-tag"></div>' +
        '</div>' +
      '</div>' +
      '<p class="app-modal-desc" id="app-modal-desc"></p>' +
      '<div class="project-meta" id="app-modal-meta"></div>' +
      '<div class="project-tech" id="app-modal-tech"></div>' +
      '<a class="btn-primary app-modal-cta" id="app-modal-cta" target="_blank" rel="noopener noreferrer"></a>' +
    '</div>';
  document.body.appendChild(backdrop);

  const modal = backdrop.querySelector('.app-modal');
  const elIcon = backdrop.querySelector('#app-modal-icon');
  const elName = backdrop.querySelector('#app-modal-name');
  const elTag = backdrop.querySelector('#app-modal-tag');
  const elDesc = backdrop.querySelector('#app-modal-desc');
  const elMeta = backdrop.querySelector('#app-modal-meta');
  const elTech = backdrop.querySelector('#app-modal-tech');
  const elCta = backdrop.querySelector('#app-modal-cta');

  let lastFocused = null;
  let openApp = null;

  function openModal(app) {
    openApp = app;
    elIcon.src = app.icon;
    elName.textContent = app.name;
    elTag.textContent = app.tag;
    elDesc.textContent = app.description;
    elCta.href = app.url;
    elCta.textContent = app.cta;
    elTech.innerHTML = (app.tech && app.tech.length)
      ? app.tech.map(t => '<span>' + t + '</span>').join('')
      : '';
    elMeta.innerHTML = '';
    if (app.repo) applyLiveStats(app);

    lastFocused = document.activeElement;
    backdrop.classList.add('open');
    document.body.classList.add('no-scroll');
    backdrop.querySelector('.app-modal-close').focus();
  }

  function closeModal() {
    backdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
    if (lastFocused) lastFocused.focus();
  }

  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.app-tile');
    if (!tile) return;
    openModal(APPS[+tile.dataset.index]);
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  backdrop.querySelector('.app-modal-close').addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });

  // ---------- Live GitHub stats (stars + last updated) ----------
  const CACHE_KEY = 'repo_stats_v1';
  const CACHE_TTL = 3600000; // 1 hour
  let statsPromise = null;

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

  function fetchStats() {
    if (statsPromise) return statsPromise;
    statsPromise = (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
      } catch { /* ignore corrupt cache */ }

      try {
        const res = await fetch('https://api.github.com/users/civarry/repos?per_page=100');
        if (!res.ok) return null;
        const repos = await res.json();
        const data = {};
        repos.forEach(r => { data[r.name] = { stars: r.stargazers_count, pushed: r.pushed_at }; });
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* full/unavailable */ }
        return data;
      } catch { return null; }
    })();
    return statsPromise;
  }

  async function applyLiveStats(app) {
    const stats = await fetchStats();
    if (openApp !== app) return; // modal moved on to a different app while this was in flight
    const info = stats && stats[app.repo];
    if (!info) return;
    const parts = [];
    if (info.stars > 0) parts.push('<span><span class="meta-star">★</span> ' + info.stars + '</span>');
    parts.push('<span>updated ' + timeAgo(info.pushed) + '</span>');
    elMeta.innerHTML = parts.join('<span>·</span>');
  }
})();
