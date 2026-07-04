// 3D hero scene — a constellation of every public repo. Nodes are projects
// (sized by stars, featured ones in accent blue), edges connect the most
// similar repos (language, topics, name/description overlap, same era), so
// clusters show how the work evolved. Drag to spin, hover for details,
// click to open the repo.
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
  const WHITE = new THREE.Color(0xaeb6bf);
  const FEATURED = new Set(['lasso-app', 'motioncast', 'psx', 'Android-File-Transfer-Mac', 'civarry.github.io']);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
  camera.position.set(0, 0, 8.4);

  const group = new THREE.Group();
  scene.add(group);

  // Faint far starfield for depth
  {
    const starCount = 350;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 5);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      color: 0x8a9099, size: 0.015, transparent: true, opacity: 0.35, depthWrite: false
    })));
  }

  // ---------- Repo data ----------
  const CACHE_KEY = 'repo_graph_v1';
  const CACHE_TTL = 3600000;

  async function getRepos() {
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

  // ---------- Similarity ----------
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
    s += 0.18 * Math.max(0, 1 - years); // built in the same era
    return Math.min(1, s);
  }

  // ---------- Force-directed 3D layout ----------
  function layout(nodes, edges) {
    const n = nodes.length;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.5 + Math.random());
      p.set([v.x, v.y, v.z], i * 3);
    }
    const f = new Float32Array(n * 3);
    for (let step = 0; step < 320; step++) {
      f.fill(0);
      // Pairwise repulsion
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
      // Springs pull similar repos together (more similar = shorter rest length)
      for (const e of edges) {
        const a = e.a * 3, b = e.b * 3;
        let dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
        const rest = 1.4 - 0.9 * e.sim;
        const k = 0.06 * (len - rest) / len;
        dx *= k; dy *= k; dz *= k;
        f[a] += dx; f[a + 1] += dy; f[a + 2] += dz;
        f[b] -= dx; f[b + 1] -= dy; f[b + 2] -= dz;
      }
      // Gentle pull to center
      for (let i = 0; i < n * 3; i++) {
        f[i] -= p[i] * 0.022;
        p[i] += Math.max(-0.12, Math.min(0.12, f[i]));
      }
    }
    // Normalize so the constellation fills a consistent radius
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      if (r > maxR) maxR = r;
    }
    const scale = 2.7 / (maxR || 1);
    for (let i = 0; i < n * 3; i++) p[i] *= scale;
    return p;
  }

  // ---------- Build the graph ----------
  let nodesMesh = null;
  let nodeData = [];
  let labelEls = [];
  let tooltip = null;
  const baseScales = [];
  const nodeWorld = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();

  function buildGraph(repos) {
    repos.forEach(r => { r.tokens = tokenize(r); });
    const n = repos.length;

    // kNN edges: each repo links to its 2 most similar peers
    const edgeMap = new Map();
    for (let i = 0; i < n; i++) {
      const sims = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        sims.push({ j, sim: similarity(repos[i], repos[j]) });
      }
      sims.sort((x, y) => y.sim - x.sim);
      sims.slice(0, 3).forEach(({ j, sim }) => {
        if (sim < 0.1) return;
        const key = Math.min(i, j) + '-' + Math.max(i, j);
        if (!edgeMap.has(key)) edgeMap.set(key, { a: Math.min(i, j), b: Math.max(i, j), sim });
      });
    }
    const edges = [...edgeMap.values()];
    const positions = layout(repos.map(r => r.name), edges);

    // Nodes — instanced spheres, sized by stars, featured in accent
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
      nodesMesh.setColorAt(i, featured ? ACCENT : WHITE);
    }
    group.add(nodesMesh);

    // Edges — brightness follows similarity
    const linePos = new Float32Array(edges.length * 6);
    const lineCol = new Float32Array(edges.length * 6);
    const dim = new THREE.Color(0x223240);
    edges.forEach((e, k) => {
      linePos.set([
        positions[e.a * 3], positions[e.a * 3 + 1], positions[e.a * 3 + 2],
        positions[e.b * 3], positions[e.b * 3 + 1], positions[e.b * 3 + 2]
      ], k * 6);
      const c = dim.clone().lerp(ACCENT, Math.min(1, e.sim * 1.2));
      lineCol.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
    group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false
    })));

    nodeData = repos.map((r, i) => ({
      ...r,
      x: positions[i * 3], y: positions[i * 3 + 1], z: positions[i * 3 + 2]
    }));

    // Always-visible labels for the featured projects
    const labelBox = document.createElement('div');
    labelBox.id = 'graph-labels';
    document.body.appendChild(labelBox);
    nodeData.forEach((r, i) => {
      if (!FEATURED.has(r.name)) return;
      const el = document.createElement('span');
      el.className = 'node-label';
      el.textContent = r.name === 'civarry.github.io' ? 'this site' :
                       r.name === 'psx' ? 'payroll' :
                       r.name === 'Android-File-Transfer-Mac' ? 'android-xfer' :
                       r.name.replace('-app', '');
      labelBox.appendChild(el);
      labelEls.push({ el, i });
    });

    // Hover tooltip
    tooltip = document.createElement('div');
    tooltip.className = 'graph-tooltip';
    document.body.appendChild(tooltip);
  }

  // ---------- Pointer: hover, click, drag ----------
  const pointer = { x: 0, y: 0, px: 0, py: 0 };
  const raycaster = new THREE.Raycaster();
  let hovered = -1;
  const heroEl = document.querySelector('.hero');
  const drag = { on: false, moved: 0, lastX: 0, lastY: 0, velX: 0, velY: 0 };

  window.addEventListener('pointermove', (e) => {
    pointer.px = e.clientX;
    pointer.py = e.clientY;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
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
  }, { passive: true });

  if (heroEl) {
    heroEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button, input')) return;
      drag.on = true;
      drag.moved = 0;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.velX = 0;
      drag.velY = 0;
      heroEl.classList.add('dragging');
    });

    const endDrag = () => {
      if (!drag.on) return;
      drag.on = false;
      heroEl.classList.remove('dragging');
      // A click (not a drag) on a node opens the repo
      if (drag.moved < 6 && hovered >= 0 && nodeData[hovered]) {
        window.open(nodeData[hovered].url, '_blank', 'noopener');
      }
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  function updateHover() {
    if (!nodesMesh || !heroVisible) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(nodesMesh);
    const id = hits.length ? hits[0].instanceId : -1;
    if (id === hovered) return;

    // Restore previous
    if (hovered >= 0) setNodeScale(hovered, 1);
    hovered = id;
    if (hovered >= 0) {
      setNodeScale(hovered, 1.6);
      const r = nodeData[hovered];
      tooltip.textContent = '';
      const title = document.createElement('strong');
      title.textContent = r.name + (r.stars ? ' · ★ ' + r.stars : '') + (r.lang ? ' · ' + r.lang : '');
      tooltip.appendChild(title);
      if (r.desc) {
        const d = document.createElement('em');
        d.textContent = r.desc.slice(0, 90) + (r.desc.length > 90 ? '…' : '');
        tooltip.appendChild(d);
      }
      tooltip.style.display = 'block';
      if (heroEl) heroEl.style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      if (heroEl) heroEl.style.cursor = '';
    }
  }

  function setNodeScale(i, mult) {
    const s = baseScales[i] * mult;
    tmpMat.makeScale(s, s, s).setPosition(nodeData[i].x, nodeData[i].y, nodeData[i].z);
    nodesMesh.setMatrixAt(i, tmpMat);
    nodesMesh.instanceMatrix.needsUpdate = true;
  }

  function updateOverlays() {
    // Featured labels track their nodes; tooltip follows the pointer
    for (const { el, i } of labelEls) {
      const r = nodeData[i];
      nodeWorld.set(r.x, r.y, r.z).applyMatrix4(group.matrixWorld);
      const front = nodeWorld.z > 0;
      nodeWorld.project(camera);
      el.style.left = ((nodeWorld.x + 1) / 2 * window.innerWidth) + 'px';
      el.style.top = ((1 - nodeWorld.y) / 2 * window.innerHeight) + 'px';
      el.style.opacity = front ? 0.9 : 0.25;
    }
    if (tooltip && hovered >= 0) {
      tooltip.style.left = (pointer.px + 14) + 'px';
      tooltip.style.top = (pointer.py + 14) + 'px';
    }
  }

  // ---------- Render loop ----------
  let running = false;
  let heroVisible = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    if (!drag.on) {
      group.rotation.y += 0.0011 + drag.velY;
      group.rotation.x += drag.velX;
      drag.velY *= 0.95;
      drag.velX *= 0.95;
      group.rotation.x += (0 - group.rotation.x) * 0.004;
    }

    group.updateMatrixWorld();
    updateHover();
    updateOverlays();
    renderer.render(scene, camera);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  // ---------- Sizing / visibility ----------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 640 ? 58 : 45;
    camera.updateProjectionMatrix();
    if (!running) { group.updateMatrixWorld(); updateOverlays(); renderer.render(scene, camera); }
  }
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('scroll', () => {
    const fade = 1 - Math.min(1, window.scrollY / (window.innerHeight * 0.8));
    canvas.style.opacity = fade.toFixed(3);
    const labels = document.getElementById('graph-labels');
    if (labels) {
      labels.style.opacity = fade.toFixed(3);
      labels.style.display = fade < 0.02 ? 'none' : '';
    }
  }, { passive: true });

  // ---------- Boot ----------
  getRepos().then(repos => {
    buildGraph(repos);
    if (reduceMotion) {
      group.updateMatrixWorld();
      updateOverlays();
      renderer.render(scene, camera);
      return;
    }
    if (heroEl && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible && !document.hidden) start(); else stop();
      }, { threshold: 0.05 }).observe(heroEl);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (heroVisible) start();
    });
    start();
  }).catch(() => {
    // API rate limited or offline — leave a clean dark hero
    canvas.style.display = 'none';
  });
})();
