// 3D project constellation — every public repo is a node (sized by stars,
// featured ones in accent blue, recently added ones glow). Edges connect the
// most similar repos: precomputed MiniLM embedding similarity from
// repo_graph.json (built nightly by a GitHub Action), with a token-overlap
// fallback for repos newer than the last nightly run.
// Controls: drag to spin, scroll / pinch / double-click to zoom, hover for
// details, click to open the repo.
// Vendored three.js (r160) because the CSP only allows same-origin scripts.
import * as THREE from './vendor/three.module.min.js';

(function () {
  const canvas = document.getElementById('scene-canvas');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    canvas.style.display = 'none';
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ACCENT = new THREE.Color(0x049ef4);
  const HIGHLIGHT = new THREE.Color(0x54c8ff);
  const WHITE = new THREE.Color(0xaeb6bf);
  const FEATURED = new Set(['lasso-app', 'motioncast', 'psx', 'Android-File-Transfer-Mac', 'civarry.github.io']);
  const NEW_MS = 30 * 86400000; // repos created in the last 30 days glow

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  const Z_HOME = 7.6, Z_MIN = 4, Z_MAX = 11;
  let targetZ = Z_HOME;
  camera.position.set(0, 0, Z_HOME);

  const group = new THREE.Group();
  scene.add(group);

  // ---------- Repo data ----------
  const CACHE_KEY = 'repo_graph_v1';
  const CACHE_TTL = 3600000;

  async function getLiveRepos() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
    } catch { /* ignore corrupt cache */ }

    const res = await fetch('https://api.github.com/users/civarry/repos?per_page=100');
    if (!res.ok) throw new Error('github api unavailable');
    const raw = await res.json();
    const data = raw
      .filter(r => !r.fork)
      .map(r => ({
        name: r.name,
        url: r.html_url,
        desc: r.description || '',
        lang: r.language || '',
        topics: r.topics || [],
        stars: r.stargazers_count,
        created: Date.parse(r.created_at)
      }));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* full */ }
    return data;
  }

  // ---------- Fallback similarity (token overlap) ----------
  const STOP = new Set(['the', 'and', 'for', 'with', 'using', 'this', 'that', 'from', 'into', 'was', 'are']);

  function tokenize(repo) {
    return new Set((repo.name + ' ' + repo.desc)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 2 && !STOP.has(w)));
  }

  function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    a.forEach(x => { if (b.has(x)) inter++; });
    return inter / (a.size + b.size - inter);
  }

  function similarity(a, b) {
    let s = 0;
    if (a.lang && a.lang === b.lang) s += 0.35;
    s += 0.4 * jaccard(a.tokens, b.tokens);
    s += 0.25 * jaccard(new Set(a.topics), new Set(b.topics));
    const years = Math.abs(a.created - b.created) / 3.15e10;
    s += 0.18 * Math.max(0, 1 - years);
    return Math.min(1, s);
  }

  function knnEdges(repos) {
    const n = repos.length;
    const edgeMap = new Map();
    for (let i = 0; i < n; i++) {
      const sims = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        sims.push({ j, sim: similarity(repos[i], repos[j]) });
      }
      sims.sort((x, y) => y.sim - x.sim);
      // Only genuinely related repos connect — unrelated ones stay scattered
      sims.slice(0, 3).forEach(({ j, sim }) => {
        if (sim < 0.2) return;
        const key = Math.min(i, j) + '-' + Math.max(i, j);
        if (!edgeMap.has(key)) edgeMap.set(key, { a: Math.min(i, j), b: Math.max(i, j), sim });
      });
    }
    return [...edgeMap.values()];
  }

  // Precomputed embedding graph first; live API to freshen stars and to
  // catch repos added since the last nightly run (those glow as new)
  async function getGraphData() {
    let file = null;
    try {
      const res = await fetch('repo_graph.json?v=' + new Date().toISOString().slice(0, 10));
      if (res.ok) file = await res.json();
    } catch { /* no graph file yet */ }

    const live = await getLiveRepos().catch(() => null);
    if (!file && !live) throw new Error('no data');

    if (!file) {
      const repos = live;
      repos.forEach(r => {
        r.tokens = tokenize(r);
        r.isNew = Date.now() - r.created < NEW_MS;
      });
      return { repos, edges: knnEdges(repos) };
    }

    const repos = file.repos.map(r => ({ ...r }));
    const edges = file.edges.map(e => ({ ...e }));
    const byName = new Map(repos.map((r, i) => [r.name, i]));
    repos.forEach(r => {
      r.tokens = tokenize(r);
      r.isNew = Date.now() - r.created < NEW_MS;
    });

    if (live) {
      for (const lr of live) {
        const i = byName.get(lr.name);
        if (i !== undefined) {
          repos[i].stars = lr.stars;
          repos[i].desc = lr.desc || repos[i].desc;
        } else {
          // Brand new repo — not embedded yet. Token similarity may relate it
          // to existing work; otherwise it floats scattered until the nightly
          // embedding run (or until related projects exist)
          lr.tokens = tokenize(lr);
          lr.isNew = true;
          const idx = repos.length;
          const sims = repos.map((r, j) => ({ j, sim: similarity(lr, r) }))
            .sort((x, y) => y.sim - x.sim)
            .slice(0, 3);
          repos.push(lr);
          sims.forEach(({ j, sim }) => {
            if (sim >= 0.2) edges.push({ a: j, b: idx, sim });
          });
        }
      }
    }
    return { repos, edges };
  }

  // ---------- Force-directed 3D layout ----------
  function layout(n, edges) {
    // Unconnected repos feel almost no center pull, so they drift visibly
    // apart from the constellation instead of hugging it
    const degree = new Array(n).fill(0);
    for (const e of edges) { degree[e.a]++; degree[e.b]++; }

    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = degree[i] > 0 ? 1.5 + Math.random() : 2.6 + Math.random() * 1.2;
      const v = new THREE.Vector3().randomDirection().multiplyScalar(r);
      p.set([v.x, v.y, v.z], i * 3);
    }
    const f = new Float32Array(n * 3);
    for (let step = 0; step < 320; step++) {
      f.fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = p[i * 3] - p[j * 3], dy = p[i * 3 + 1] - p[j * 3 + 1], dz = p[i * 3 + 2] - p[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz + 0.01;
          const k = 0.06 / d2;
          dx *= k; dy *= k; dz *= k;
          f[i * 3] += dx; f[i * 3 + 1] += dy; f[i * 3 + 2] += dz;
          f[j * 3] -= dx; f[j * 3 + 1] -= dy; f[j * 3 + 2] -= dz;
        }
      }
      for (const e of edges) {
        const a = e.a * 3, b = e.b * 3;
        let dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
        const rest = 1.4 - 0.9 * Math.min(1, e.sim);
        const k = 0.06 * (len - rest) / len;
        dx *= k; dy *= k; dz *= k;
        f[a] += dx; f[a + 1] += dy; f[a + 2] += dz;
        f[b] -= dx; f[b + 1] -= dy; f[b + 2] -= dz;
      }
      for (let i = 0; i < n; i++) {
        const pull = degree[i] > 0 ? 0.022 : 0.004;
        for (let c = 0; c < 3; c++) {
          const k = i * 3 + c;
          f[k] -= p[k] * pull;
          p[k] += Math.max(-0.12, Math.min(0.12, f[k]));
        }
      }
    }
    // Normalize so the connected constellation fills radius 2.4; scattered
    // nodes may sit further out, clamped to stay in frame
    let maxConnected = 0;
    for (let i = 0; i < n; i++) {
      if (degree[i] === 0) continue;
      const r = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      if (r > maxConnected) maxConnected = r;
    }
    const scale = 2.4 / (maxConnected || 1);
    for (let i = 0; i < n * 3; i++) p[i] *= scale;
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      if (r > 3.4) {
        const s = 3.4 / r;
        p[i * 3] *= s; p[i * 3 + 1] *= s; p[i * 3 + 2] *= s;
      }
    }
    return p;
  }

  // ---------- Build the graph ----------
  let nodesMesh = null;
  let nodeData = [];
  let labelEls = [];
  let glowSprites = [];
  let tooltip = null;
  let edgeList = [];
  let linesObj = null;
  let lineColAttr = null;
  let baseLineCol = null;
  const baseScales = [];
  const nodeWorld = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(120, 210, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(4, 158, 244, 0.35)');
    grad.addColorStop(1, 'rgba(4, 158, 244, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function buildGraph(repos, edges) {
    const n = repos.length;
    edgeList = edges;
    const positions = layout(n, edgeList);

    const geo = new THREE.SphereGeometry(0.045, 12, 10);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    nodesMesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const featured = FEATURED.has(repos[i].name);
      const s = (1 + 0.35 * Math.log2(repos[i].stars + 1)) * (featured ? 1.5 : 1);
      baseScales.push(s);
      m.makeScale(s, s, s).setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      nodesMesh.setMatrixAt(i, m);
      nodesMesh.setColorAt(i, repos[i].isNew ? HIGHLIGHT : featured ? ACCENT : WHITE);
    }
    group.add(nodesMesh);

    const linePos = new Float32Array(edgeList.length * 6);
    const lineCol = new Float32Array(edgeList.length * 6);
    const dim = new THREE.Color(0x223240);
    edgeList.forEach((e, k) => {
      linePos.set([
        positions[e.a * 3], positions[e.a * 3 + 1], positions[e.a * 3 + 2],
        positions[e.b * 3], positions[e.b * 3 + 1], positions[e.b * 3 + 2]
      ], k * 6);
      const c = dim.clone().lerp(ACCENT, Math.min(1, e.sim * 1.2));
      lineCol.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
    });
    baseLineCol = lineCol.slice();
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    lineColAttr = new THREE.BufferAttribute(lineCol, 3);
    lineGeo.setAttribute('color', lineColAttr);
    linesObj = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false
    }));
    group.add(linesObj);

    nodeData = repos.map((r, i) => ({
      ...r,
      x: positions[i * 3], y: positions[i * 3 + 1], z: positions[i * 3 + 2]
    }));

    // Pulsing glow behind newly added repos
    const tex = nodeData.some(r => r.isNew) ? glowTexture() : null;
    nodeData.forEach((r, i) => {
      if (!r.isNew) return;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      const base = 0.55 * baseScales[i];
      sp.position.set(r.x, r.y, r.z);
      sp.scale.set(base, base, 1);
      group.add(sp);
      glowSprites.push({ sp, base, phase: i });
    });

    // Always-visible labels: featured projects + anything new
    const labelBox = document.createElement('div');
    labelBox.id = 'graph-labels';
    document.body.appendChild(labelBox);
    nodeData.forEach((r, i) => {
      const featured = FEATURED.has(r.name);
      if (!featured && !r.isNew) return;
      const el = document.createElement('span');
      el.className = 'node-label' + (r.isNew ? ' node-label-new' : '');
      el.textContent = r.isNew ? r.name :
                       r.name === 'civarry.github.io' ? 'this site' :
                       r.name === 'psx' ? 'payroll' :
                       r.name === 'Android-File-Transfer-Mac' ? 'android-xfer' :
                       r.name.replace('-app', '');
      labelBox.appendChild(el);
      labelEls.push({ el, i });
    });

    tooltip = document.createElement('div');
    tooltip.className = 'graph-tooltip';
    document.body.appendChild(tooltip);
  }

  // ---------- Pointer: hover, click, drag, zoom (all on the canvas) ----------
  const pointer = { x: 0, y: 0, px: 0, py: 0, over: false };
  const raycaster = new THREE.Raycaster();
  let hovered = -1;
  let lastOpen = 0;
  const drag = { on: false, moved: 0, lastX: 0, lastY: 0, velX: 0, velY: 0 };
  const pinch = { pts: new Map(), dist: 0 };

  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.px = e.clientX;
    pointer.py = e.clientY;
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickNode() {
    if (!nodesMesh || !pointer.over) return -1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(nodesMesh);
    return hits.length ? hits[0].instanceId : -1;
  }

  function pickEdge() {
    if (!linesObj || !pointer.over) return -1;
    raycaster.params.Line.threshold = 0.06;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(linesObj);
    return hits.length ? Math.floor(hits[0].index / 2) : -1;
  }

  canvas.addEventListener('pointerenter', () => { pointer.over = true; });
  canvas.addEventListener('pointerleave', () => { pointer.over = false; });

  canvas.addEventListener('pointerdown', (e) => {
    setPointer(e);
    canvas.setPointerCapture(e.pointerId);
    pinch.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.pts.size === 2) {
      drag.on = false;
      canvas.classList.remove('dragging');
      pinch.dist = 0;
      return;
    }
    drag.on = true;
    drag.moved = 0;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.velX = 0;
    drag.velY = 0;
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (e) => {
    setPointer(e);
    pointer.over = true;
    if (pinch.pts.has(e.pointerId)) {
      pinch.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch.pts.size === 2) {
        const [p1, p2] = [...pinch.pts.values()];
        const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
        if (pinch.dist > 0) {
          targetZ = Math.min(Z_MAX, Math.max(Z_MIN, targetZ * (pinch.dist / d)));
        }
        pinch.dist = d;
        return;
      }
    }
    if (drag.on) {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.velY = dx * 0.005;
      drag.velX = dy * 0.003;
      group.rotation.y += drag.velY;
      group.rotation.x += drag.velX;
    }
  });

  const endPointer = (e) => {
    pinch.pts.delete(e.pointerId);
    if (pinch.pts.size < 2) pinch.dist = 0;
    if (!drag.on) return;
    drag.on = false;
    canvas.classList.remove('dragging');
    if (drag.moved < 8) {
      const id = pickNode();
      if (id >= 0 && nodeData[id] && Date.now() - lastOpen > 600) {
        lastOpen = Date.now();
        window.open(nodeData[id].url, '_blank', 'noopener');
      }
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  // The canvas is a contained widget, so plain scroll zooms it
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZ = Math.min(Z_MAX, Math.max(Z_MIN, targetZ + e.deltaY * 0.012));
  }, { passive: false });

  canvas.addEventListener('dblclick', () => {
    if (pickNode() >= 0) return;
    targetZ = targetZ > 6 ? Z_MIN + 0.8 : Z_HOME;
  });

  let hoveredEdge = -1;

  function recolorEdges() {
    if (!lineColAttr) return;
    const arr = lineColAttr.array;
    arr.set(baseLineCol);
    const paint = (k) => arr.set(
      [HIGHLIGHT.r, HIGHLIGHT.g, HIGHLIGHT.b, HIGHLIGHT.r, HIGHLIGHT.g, HIGHLIGHT.b], k * 6);
    if (hovered >= 0) {
      edgeList.forEach((e, k) => { if (e.a === hovered || e.b === hovered) paint(k); });
    } else if (hoveredEdge >= 0) {
      paint(hoveredEdge);
    }
    lineColAttr.needsUpdate = true;
  }

  function updateHover() {
    if (!nodesMesh || drag.on) return;
    const id = pickNode();
    const ek = id >= 0 ? -1 : pickEdge();
    if (id === hovered && ek === hoveredEdge) return;

    if (hovered >= 0) setNodeScale(hovered, 1);
    hovered = id;
    hoveredEdge = ek;
    recolorEdges();

    if (hovered >= 0) {
      setNodeScale(hovered, 1.6);
      const r = nodeData[hovered];
      tooltip.textContent = '';
      const title = document.createElement('strong');
      title.textContent = r.name + (r.isNew ? ' · new' : '') +
        (r.stars ? ' · ★ ' + r.stars : '') + (r.lang ? ' · ' + r.lang : '');
      tooltip.appendChild(title);
      if (r.desc) {
        const d = document.createElement('em');
        d.textContent = r.desc.slice(0, 90) + (r.desc.length > 90 ? '…' : '');
        tooltip.appendChild(d);
      }
      tooltip.style.display = 'block';
      canvas.style.cursor = 'pointer';
    } else if (hoveredEdge >= 0) {
      const e = edgeList[hoveredEdge];
      tooltip.textContent = '';
      const title = document.createElement('strong');
      title.textContent = nodeData[e.a].name + ' ↔ ' + nodeData[e.b].name;
      tooltip.appendChild(title);
      const d = document.createElement('em');
      d.textContent = Math.round(Math.min(1, e.sim) * 100) + '% similar';
      tooltip.appendChild(d);
      tooltip.style.display = 'block';
      canvas.style.cursor = '';
    } else {
      tooltip.style.display = 'none';
      canvas.style.cursor = '';
    }
  }

  function setNodeScale(i, mult) {
    const s = baseScales[i] * mult;
    tmpMat.makeScale(s, s, s).setPosition(nodeData[i].x, nodeData[i].y, nodeData[i].z);
    nodesMesh.setMatrixAt(i, tmpMat);
    nodesMesh.instanceMatrix.needsUpdate = true;
  }

  function updateOverlays() {
    const rect = canvas.getBoundingClientRect();
    for (const { el, i } of labelEls) {
      const r = nodeData[i];
      nodeWorld.set(r.x, r.y, r.z).applyMatrix4(group.matrixWorld);
      const front = nodeWorld.z > 0;
      nodeWorld.project(camera);
      el.style.left = (rect.left + (nodeWorld.x + 1) / 2 * rect.width) + 'px';
      el.style.top = (rect.top + (1 - nodeWorld.y) / 2 * rect.height) + 'px';
      el.style.opacity = front ? 0.9 : 0.25;
    }
    if (tooltip && hovered >= 0) {
      tooltip.style.left = (pointer.px + 14) + 'px';
      tooltip.style.top = (pointer.py + 14) + 'px';
    }
  }

  // ---------- Render loop ----------
  const clock = new THREE.Clock();
  let running = false;
  let sceneVisible = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    const t = clock.getElapsedTime();

    if (!drag.on) {
      // Reduced motion: no idle auto-spin, but drag momentum (user-initiated)
      // still settles naturally
      group.rotation.y += (reduceMotion ? 0 : 0.0011) + drag.velY;
      group.rotation.x += drag.velX;
      drag.velY *= 0.95;
      drag.velX *= 0.95;
      group.rotation.x += (0 - group.rotation.x) * 0.004;
    }

    camera.position.z += (targetZ - camera.position.z) * 0.08;

    if (!reduceMotion) {
      for (const g of glowSprites) {
        const s = g.base * (1 + 0.22 * Math.sin(t * 2.4 + g.phase));
        g.sp.scale.set(s, s, 1);
      }
    }

    group.updateMatrixWorld();
    updateHover();
    updateOverlays();
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  // ---------- Sizing / visibility ----------
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.9 ? 56 : 48;
    camera.updateProjectionMatrix();
    if (!running) { group.updateMatrixWorld(); updateOverlays(); renderer.render(scene, camera); }
  }
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- Boot ----------
  getGraphData().then(({ repos, edges }) => {
    buildGraph(repos, edges);
    resize();
    const labelBox = document.getElementById('graph-labels');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        sceneVisible = entries[0].isIntersecting;
        if (labelBox) labelBox.style.display = sceneVisible ? '' : 'none';
        if (sceneVisible && !document.hidden) start(); else stop();
      }, { threshold: 0.05 }).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (sceneVisible) start();
    });
    start();
  }).catch(() => {
    canvas.style.display = 'none';
  });
})();
