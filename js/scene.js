// 3D hero scene — particle sphere with cursor repulsion.
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
  const WHITE = new THREE.Color(0xbfc7cf);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);

  // ----- Particle sphere (fibonacci lattice → perfectly even, symmetric) -----
  const COUNT = 6000;
  const RADIUS = 2.6;
  const basePos = new Float32Array(COUNT * 3); // unit directions
  const phase = new Float32Array(COUNT);
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);

  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN * i;
    basePos[i * 3] = Math.cos(theta) * r;
    basePos[i * 3 + 1] = y;
    basePos[i * 3 + 2] = Math.sin(theta) * r;
    phase[i] = (i * 0.618034) % 1;

    // Mostly soft white, a scattered eighth in accent blue
    const c = i % 8 === 0 ? ACCENT : WHITE;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.022,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    depthWrite: false
  }));

  // Faint wireframe core for depth
  const core = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(RADIUS * 0.5, 1)),
    new THREE.LineBasicMaterial({ color: 0x049ef4, transparent: true, opacity: 0.14 })
  );

  const group = new THREE.Group();
  group.add(points);
  group.add(core);
  scene.add(group);

  // ----- Pointer interaction -----
  const pointer = { x: 0, y: 0, active: false };
  let pointerStrength = 0; // eased 0..1
  const hitLocal = new THREE.Vector3(0, 0, 1);
  const rayDir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const invQuat = new THREE.Quaternion();

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointer.active = true;
  }, { passive: true });
  window.addEventListener('pointerleave', () => { pointer.active = false; });
  window.addEventListener('touchend', () => { pointer.active = false; });

  function updateHitPoint() {
    // Ray from camera through pointer, intersected with the sphere
    rayDir.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize();
    const b = camera.position.dot(rayDir);
    const c = camera.position.lengthSq() - RADIUS * RADIUS;
    const disc = b * b - c;
    if (disc >= 0) {
      tmp.copy(camera.position).addScaledVector(rayDir, -b - Math.sqrt(disc));
    } else {
      tmp.copy(camera.position).addScaledVector(rayDir, -b); // closest approach
    }
    tmp.normalize();
    // Into the group's local space so the bump tracks the rotating sphere
    invQuat.copy(group.quaternion).invert();
    hitLocal.copy(tmp).applyQuaternion(invQuat);
  }

  // ----- Render loop -----
  const clock = new THREE.Clock();
  let running = false;
  let heroVisible = true;

  function updatePositions(t) {
    const posAttr = geo.attributes.position.array;
    const hx = hitLocal.x, hy = hitLocal.y, hz = hitLocal.z;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const dx = basePos[ix], dy = basePos[ix + 1], dz = basePos[ix + 2];
      // Gentle breathing
      let r = RADIUS * (1 + 0.035 * Math.sin(t * 1.1 + phase[i] * Math.PI * 2));
      // Cursor bump — gaussian falloff by angular distance to the hit point
      if (pointerStrength > 0.01) {
        const dot = dx * hx + dy * hy + dz * hz;
        const ang = Math.acos(Math.min(1, Math.max(-1, dot)));
        const g = Math.exp(-(ang * 3.4) * (ang * 3.4));
        r += RADIUS * 0.28 * g * pointerStrength;
      }
      posAttr[ix] = dx * r;
      posAttr[ix + 1] = dy * r;
      posAttr[ix + 2] = dz * r;
    }
    geo.attributes.position.needsUpdate = true;
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    const t = clock.getElapsedTime();
    group.rotation.y += 0.0012;
    core.rotation.y -= 0.002;
    core.rotation.x += 0.0008;

    // Parallax toward pointer
    group.rotation.x += ((pointer.y * -0.18) - group.rotation.x) * 0.04;

    pointerStrength += ((pointer.active ? 1 : 0) - pointerStrength) * 0.06;
    if (pointer.active || pointerStrength > 0.01) updateHitPoint();
    updatePositions(t);

    renderer.render(scene, camera);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    clock.start();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  // ----- Sizing / visibility -----
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 640 ? 58 : 45; // keep the sphere fully in frame on phones
    camera.updateProjectionMatrix();
    if (!running) { updatePositions(0); renderer.render(scene, camera); }
  }
  window.addEventListener('resize', resize);
  resize();

  if (reduceMotion) {
    // Single static frame — no animation
    updatePositions(0);
    renderer.render(scene, camera);
  } else {
    // Only animate while the hero is on screen and the tab is visible
    const hero = document.querySelector('.hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible && !document.hidden) start(); else stop();
      }, { threshold: 0.05 }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (heroVisible) start();
    });
    start();
  }

  // Fade the scene out as the user scrolls past the hero
  window.addEventListener('scroll', () => {
    const fade = 1 - Math.min(1, window.scrollY / (window.innerHeight * 0.8));
    canvas.style.opacity = fade.toFixed(3);
  }, { passive: true });
})();
