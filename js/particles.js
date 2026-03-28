// ========== Particle Background Animation ==========
// Antigravity-style floating particles with mouse interaction
(function () {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const PARTICLE_COUNT = 70;
  const MOUSE_RADIUS = 150;
  const MOUSE_FORCE = 0.6;
  const BASE_SPEED = 0.3;
  const CONNECT_DIST = 120;

  let width, height;
  let mouse = { x: -9999, y: -9999 };
  let particles = [];
  let animId;

  // Colors: blue to purple gradient
  const COLORS = [
    'rgba(59, 130, 246, 0.6)',   // blue
    'rgba(99, 102, 241, 0.6)',   // indigo
    'rgba(139, 92, 246, 0.55)',  // violet
    'rgba(168, 85, 247, 0.5)',   // purple
    'rgba(79, 120, 230, 0.55)',  // mid-blue
    'rgba(124, 96, 238, 0.5)',   // blue-purple
  ];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function createParticle() {
    const isDash = Math.random() < 0.3;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * BASE_SPEED,
      vy: -Math.random() * BASE_SPEED * 0.8 - 0.1, // gentle upward drift
      size: isDash ? 1 : Math.random() * 2 + 1,
      dash: isDash,
      dashLen: isDash ? Math.random() * 6 + 3 : 0,
      angle: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.5 + 0.3,
      pulseSpeed: Math.random() * 0.01 + 0.005,
      pulseOffset: Math.random() * Math.PI * 2,
    };
  }

  function init() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }
  }

  function update() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Mouse interaction — gentle push away
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      // Apply velocity with damping
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Gentle upward drift when idle
      p.vy -= 0.003;

      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges with padding
      const pad = 20;
      if (p.x < -pad) p.x = width + pad;
      if (p.x > width + pad) p.x = -pad;
      if (p.y < -pad) p.y = height + pad;
      if (p.y > height + pad) p.y = -pad;

      // Slowly rotate dashes
      if (p.dash) p.angle += 0.005;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const time = performance.now() * 0.001;

    // Draw subtle connections between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          const opacity = (1 - dist / CONNECT_DIST) * 0.08;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(120, 110, 240, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const pulse = Math.sin(time * p.pulseSpeed * 60 + p.pulseOffset) * 0.15 + 0.85;
      const alpha = p.alpha * pulse;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.dash) {
        // Draw dash
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.moveTo(-p.dashLen / 2, 0);
        ctx.lineTo(p.dashLen / 2, 0);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  // Event listeners
  window.addEventListener('resize', resize);

  document.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  document.addEventListener('mouseleave', function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // Pause when tab is not visible
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      loop();
    }
  });

  // Initialize
  resize();
  init();
  loop();
})();
