// ========== Console Easter Egg ==========
console.log(
  '%c\n' +
  '  ██████╗ ██╗\n' +
  ' ██╔════╝ ██║\n' +
  ' ██║      ██║\n' +
  ' ██║      ██║\n' +
  ' ╚██████╗ ██████╗\n' +
  '  ╚═════╝ ╚═════╝\n',
  'color: #3b82f6; font-family: monospace; font-size: 12px;'
);
console.log(
  '%cYou opened DevTools. I respect that.',
  'color: #22c55e; font-size: 14px; font-weight: bold;'
);
console.log(
  '%cLooking for bugs? Hire me instead.\n' +
  '%cgithub.com/civarry  •  linkedin.com/in/cccarito\n',
  'color: #888; font-size: 12px;',
  'color: #3b82f6; font-size: 11px;'
);

// ========== DevTools Shortcut Intercept ==========
document.addEventListener('keydown', function (e) {
  // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Cmd+Option+I (Mac)
  const isDevTools =
    e.key === 'F12' ||
    ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'));

  if (isDevTools) {
    // Show it once in the page, don't block the action
    const existing = document.getElementById('devtools-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'devtools-toast';
    toast.className = 'devtools-toast';
    toast.textContent = 'Curious? Check the console.';
    document.body.appendChild(toast);

    setTimeout(function () { toast.classList.add('devtools-toast-visible'); }, 10);
    setTimeout(function () { toast.classList.remove('devtools-toast-visible'); }, 2500);
    setTimeout(function () { toast.remove(); }, 3000);
  }
});

// Intercept right-click
document.addEventListener('contextmenu', function (e) {
  // Only intercept once per session
  if (window._ctxShown) return;
  window._ctxShown = true;

  e.preventDefault();

  const toast = document.createElement('div');
  toast.className = 'devtools-toast';
  toast.textContent = 'Go ahead, inspect away. I left something in the console.';
  document.body.appendChild(toast);

  setTimeout(function () { toast.classList.add('devtools-toast-visible'); }, 10);
  setTimeout(function () { toast.classList.remove('devtools-toast-visible'); }, 2500);
  setTimeout(function () { toast.remove(); }, 3000);
});

// ========== Supabase Configuration ==========
// Congrats, you found the key. Go ahead, try something. I'll wait.
const SUPABASE_URL = 'https://bxrpppfiplqddcuzmfnq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cnBwcGZpcGxxZGRjdXptZm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA2MTIsImV4cCI6MjA5MDA2NjYxMn0.zmjs_vOHMawG1QJxrzJ6j7LoZa94tC4Ajcfx17OcO2Y';

// ========== Input Sanitization (OWASP) ==========
function sanitize(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function isValidEmail(email) {
  // RFC 5322 simplified — rejects obvious garbage without being overly strict
  return /^[^\s@<>'"`;]+@[^\s@<>'"`;]+\.[^\s@<>'"`;]{2,}$/.test(email);
}

// ========== Rate Limiting ==========
const RATE_LIMIT = { maxMessages: 3, windowMs: 3600000 }; // 3 per hour

function isRateLimited() {
  try {
    const timestamps = JSON.parse(localStorage.getItem('msg_ts') || '[]');
    const now = Date.now();
    const recent = timestamps.filter(t => now - t < RATE_LIMIT.windowMs);
    return recent.length >= RATE_LIMIT.maxMessages;
  } catch {
    return true; // Fail closed — assume rate limited if state is corrupt
  }
}

function recordSubmission() {
  try {
    const timestamps = JSON.parse(localStorage.getItem('msg_ts') || '[]');
    const now = Date.now();
    const recent = timestamps.filter(t => now - t < RATE_LIMIT.windowMs);
    recent.push(now);
    localStorage.setItem('msg_ts', JSON.stringify(recent));
  } catch {
    // localStorage unavailable — degrade gracefully
  }
}

// ========== Supabase Client ==========
const supabase = {
  async insert(table, data) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to insert: ${response.statusText}`);
    }

    const rows = await response.json();
    return rows[0] || null;
  },

  async getStatus(id) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${id}&select=status`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return rows[0]?.status || null;
  }
};

// ========== Typing Animation ==========
const phrases = [
  'automation tools.',
  'AI applications.',
  'things that should exist.',
  'solutions to problems I hate.',
  'data-driven solutions.',
  'cross-platform apps.',
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typedEl = document.getElementById('typed-text');

function type() {
  if (!typedEl) return;

  const current = phrases[phraseIndex];

  if (isDeleting) {
    charIndex--;
    typedEl.textContent = current.substring(0, charIndex);
  } else {
    charIndex++;
    typedEl.textContent = current.substring(0, charIndex);
  }

  let delay = isDeleting ? 30 : 60;

  if (!isDeleting && charIndex === current.length) {
    delay = 2000;
    isDeleting = true;
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    delay = 400;
  }

  setTimeout(type, delay);
}

type();

// ========== Scroll Reveal (Intersection Observer) ==========
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// ========== Navbar Scroll Effect (auto-hide on scroll down, show on scroll up) ==========
const navbar = document.getElementById('navbar');
let lastScrollY = 0;

window.addEventListener('scroll', () => {
  const currentY = window.scrollY;

  if (currentY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  if (currentY > lastScrollY && currentY > 80) {
    navbar.classList.add('nav-hidden');
  } else {
    navbar.classList.remove('nav-hidden');
  }

  lastScrollY = currentY;
}, { passive: true });

// ========== Mobile Nav Toggle ==========
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('active');
  navLinks.classList.toggle('open');
});

// Close mobile nav when clicking a link
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('active');
    navLinks.classList.remove('open');
  });
});

// ========== Character Counter ==========
const messageInput = document.getElementById('message');
const charCount = document.getElementById('char-count');

if (messageInput && charCount) {
  messageInput.addEventListener('input', () => {
    const len = messageInput.value.length;
    charCount.textContent = `${len} / 2000`;
    charCount.style.color = len > 1800 ? '#ef4444' : '';
  });
}

// ========== Contact Form Handler ==========
const form = document.getElementById('contact-form');
const submitBtn = document.getElementById('submit-btn');
const formStatus = document.getElementById('form-status');
const formLoadTime = Date.now();

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Anti-bot: honeypot check
  const honeypot = document.getElementById('website');
  if (honeypot && honeypot.value) {
    // Bot detected — fake success so it doesn't retry
    formStatus.textContent = 'Message sent! I\'ll get back to you soon.';
    formStatus.className = 'form-status success';
    form.reset();
    return;
  }

  // Anti-bot: time gate (must spend at least 3 seconds on page)
  if (Date.now() - formLoadTime < 3000) {
    formStatus.textContent = 'Please take a moment before submitting.';
    formStatus.className = 'form-status warning';
    return;
  }

  // Rate limiting check
  if (isRateLimited()) {
    formStatus.textContent = 'You\'ve sent too many messages. Please try again later.';
    formStatus.className = 'form-status warning';
    return;
  }

  // Get form data — stored raw, sanitization happens at render time (OWASP best practice)
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();

  // Validation
  if (!name || !email || !message) {
    formStatus.textContent = 'Please fill in all fields.';
    formStatus.className = 'form-status error';
    return;
  }

  if (name.length > 100) {
    formStatus.textContent = 'Name is too long.';
    formStatus.className = 'form-status error';
    return;
  }

  if (!isValidEmail(email)) {
    formStatus.textContent = 'Please enter a valid email address.';
    formStatus.className = 'form-status error';
    return;
  }

  if (email.length > 254) {
    formStatus.textContent = 'Email is too long.';
    formStatus.className = 'form-status error';
    return;
  }

  if (message.length > 2000) {
    formStatus.textContent = 'Message is too long (2000 characters max).';
    formStatus.className = 'form-status error';
    return;
  }

  if (message.length < 10) {
    formStatus.textContent = 'Please write a bit more in your message.';
    formStatus.className = 'form-status error';
    return;
  }

  // UI: loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  formStatus.className = 'form-status';

  try {
    const row = await supabase.insert('messages', {
      name: name,
      email: email,
      message: message
    });

    recordSubmission();
    form.reset();
    if (charCount) charCount.textContent = '0 / 2000';
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');

    if (row && row.id) {
      showPipeline(row.id, email);
    } else {
      formStatus.textContent = 'Message sent! I\'ll get back to you soon.';
      formStatus.className = 'form-status success';
    }

  } catch (error) {
    formStatus.textContent = 'Something went wrong. Please try again.';
    formStatus.className = 'form-status error';
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
  }
});

// ========== Pipeline Visualization ==========
const PIPELINE_STEPS = [
  { key: 'received', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', label: 'Message Received', desc: 'Saved to database' },
  { key: 'ai_drafting', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2 1 3.5 2 4.5L4 17v2h16v-2l-6-6.5c1-1 2-2.5 2-4.5a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1"/></svg>', label: 'AI Analyzing', desc: 'Crafting a personalized response' },
  { key: 'notifying', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>', label: 'CJ Notified', desc: 'Sent to Telegram' },
  { key: 'done', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>', label: 'Reply Queued', desc: 'CJ will review and reply personally' }
];

// Maps backend status → pipeline step index
const STATUS_MAP = { received: 0, ai_drafting: 1, notifying: 2, done: 3, replied: 3 };
const MIN_STEP_DELAY = 1500; // minimum 1.5s between step animations

function showPipeline(messageId, userEmail) {
  const form = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');
  formStatus.className = 'form-status';
  formStatus.textContent = '';

  const pipeline = document.createElement('div');
  pipeline.className = 'pipeline';
  pipeline.innerHTML = `
    <div class="pipeline-header">
      <div class="pipeline-icon-pulse"></div>
      <h3>Processing Your Message</h3>
      <p>Watch the magic happen in real-time</p>
    </div>
    <div class="pipeline-steps">
      ${PIPELINE_STEPS.map((step, i) => `
        <div class="pipeline-step" data-step="${step.key}" data-index="${i}">
          <div class="step-node">
            <div class="step-icon-ring">
              <span class="step-icon">${step.icon}</span>
            </div>
          </div>
          <div class="step-content">
            <span class="step-label">${step.label}</span>
            <span class="step-desc">${step.desc}</span>
          </div>
          <div class="step-status">
            <svg class="step-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="pipeline-footer" style="display:none;">
      <p>CJ will review your message and reply to <strong>${sanitize(userEmail)}</strong></p>
    </div>
  `;

  form.style.display = 'none';
  const cpBody = form.closest('.cp-body') || form.parentNode;
  const cpSubtitle = cpBody.querySelector('.cp-subtitle');
  if (cpSubtitle) cpSubtitle.style.display = 'none';
  cpBody.appendChild(pipeline);
  setTimeout(() => pipeline.classList.add('visible'), 50);

  // Step 0 activates immediately — message is already in the database
  let animatedStep = -1;
  let targetStep = 0;
  let finished = false;

  // Animate: advances one step at a time with minimum delay
  function animateNext() {
    if (animatedStep >= targetStep) {
      if (!finished) setTimeout(animateNext, 500);
      return;
    }
    animatedStep++;
    const step = pipeline.querySelector(`[data-index="${animatedStep}"]`);
    if (step && !step.classList.contains('active')) {
      step.classList.add('active');
      setTimeout(() => step.classList.add('completed'), 500);
    }

    if (animatedStep >= PIPELINE_STEPS.length - 1) {
      finished = true;
      const footer = pipeline.querySelector('.pipeline-footer');
      const header = pipeline.querySelector('.pipeline-header p');
      setTimeout(() => {
        header.textContent = 'All done!';
        pipeline.querySelector('.pipeline-icon-pulse').classList.add('complete');
        footer.style.display = 'block';
      }, 800);
    } else {
      setTimeout(animateNext, MIN_STEP_DELAY);
    }
  }

  setTimeout(animateNext, 800);

  // Poll: updates targetStep based on real backend status
  const pollId = setInterval(async () => {
    const status = await supabase.getStatus(messageId);
    if (!status) return;

    const step = STATUS_MAP[status];
    if (step !== undefined && step > targetStep) targetStep = step;

    if (status === 'done' || status === 'replied') {
      targetStep = PIPELINE_STEPS.length - 1;
      clearInterval(pollId);
    }
  }, 2000);

  // Timeout after 90s
  setTimeout(() => {
    if (!finished) {
      clearInterval(pollId);
      const header = pipeline.querySelector('.pipeline-header p');
      header.textContent = 'Taking longer than usual. You\'ll still get a reply via email.';
    }
  }, 90000);
}

// ========== Remote Control (Telegram → Supabase → Site) ==========
let currentTheme = 'dark';
let lastAnnounceUpdate = null;
let announceTimer = null;

async function fetchSiteSettings() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=key,value,updated_at`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!response.ok) return;
    const settings = await response.json();

    for (const setting of settings) {
      if (setting.key === 'theme') {
        applyTheme(setting.value);
      } else if (setting.key === 'announce') {
        applyAnnouncement(setting.value, setting.updated_at);
      }
    }
  } catch {
    // Silent fail — remote control is optional
  }
}

function applyTheme(theme) {
  if (theme === currentTheme) return;
  currentTheme = theme;
  if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
}

function applyAnnouncement(announce, updatedAt) {
  const banner = document.getElementById('announce-banner');
  const text = document.getElementById('announce-text');
  if (!banner || !text) return;

  if (!announce.active) {
    banner.style.display = 'none';
    lastAnnounceUpdate = null;
    return;
  }

  // Don't re-show the same announcement
  if (updatedAt === lastAnnounceUpdate) return;
  lastAnnounceUpdate = updatedAt;

  text.textContent = announce.message;
  text.classList.remove('scrolling');
  text.style.removeProperty('--marquee-duration');
  text.style.removeProperty('--marquee-distance');
  banner.style.display = 'block';
  banner.className = `announce-banner ${announce.type || 'flash'}`;

  // Enable marquee scroll if text overflows
  requestAnimationFrame(() => {
    const container = text.parentElement;
    if (text.scrollWidth > container.clientWidth) {
      const gap = 80;
      const distance = text.scrollWidth + gap;
      const speed = 60; // pixels per second
      text.style.setProperty('--marquee-duration', `${distance / speed}s`);
      text.style.setProperty('--marquee-distance', `-${distance}px`);
      text.style.paddingRight = `${gap}px`;
      text.classList.add('scrolling');
    } else {
      text.style.paddingRight = '';
    }
  });

  // Auto-dismiss for flash type
  if (announceTimer) clearTimeout(announceTimer);
  if (announce.type === 'flash' && announce.duration > 0) {
    announceTimer = setTimeout(() => {
      banner.style.display = 'none';
    }, announce.duration * 1000);
  }
}

// Close button
const announceClose = document.getElementById('announce-close');
if (announceClose) {
  announceClose.addEventListener('click', () => {
    const banner = document.getElementById('announce-banner');
    if (banner) banner.style.display = 'none';
  });
}

// Poll settings every 5 seconds
fetchSiteSettings();
setInterval(fetchSiteSettings, 5000);

// ========== Interactive Terminal ==========

// Virtual filesystem
const FS = {
  '.bashrc': [
    "alias yolo='git push --force origin main'",
    "alias please='sudo'",
    "alias fml='git reset --hard HEAD~1'",
    "export PS1='visitor@cj:\\w$ '",
    '',
    '# Why are you reading my bashrc?'
  ],
  '.env': [
    '# DO NOT COMMIT THIS FILE',
    'DB_HOST=localhost',
    'DB_USER=admin',
    'DB_PASS=correcthorsebatterystaple',
    'SUPABASE_URL=https://totally-real-db.supabase.co',
    'SUPABASE_KEY=not-a-real-key-but-nice-try',
    'OPENAI_KEY=lol-you-thought-this-was-real',
    'SECRET_MSG=aHR0cHM6Ly95b3V0dS5iZS9kUXc0dzlXZ1hjUQ=='
  ],
  'about.txt': [
    'Name:     CJ Carito',
    'Role:     Data Scientist & Developer',
    'Location: Quezon City, PH',
    'Coffee:   Required',
    '',
    'I find problems that annoy me, then build things to fix them.',
    "3+ years in tech — ML, LLMs, and building things that",
    "probably shouldn't be running on free tiers."
  ],
  'skills.json': [
    '{',
    '  "languages": ["Python", "SQL", "JavaScript", "Dart"],',
    '  "frameworks": ["Flask", "Django", "React", "Streamlit", "Flutter"],',
    '  "ai_ml": ["TensorFlow", "Scikit-learn", "LLMs", "RAG", "NLP"],',
    '  "data": ["PySpark", "Pandas", "Databricks"],',
    '  "backend": ["Supabase", "GitHub Actions", "REST APIs"],',
    '  "tools": ["Git", "Linux", "Docker"],',
    '  "philosophy": "If it solves the problem, I\'ll learn it."',
    '}'
  ],
  'contact.yml': [
    'contact:',
    '  github: github.com/civarry',
    '  linkedin: linkedin.com/in/cccarito',
    '  form: "scroll down — it has a cool pipeline viz"'
  ],
  'education.md': [
    '# Education',
    'BS Computer Science',
    'Our Lady of Fatima University',
    '2019 - 2023'
  ],
  'easter_eggs.sh': [
    '#!/bin/bash',
    '# You found one! But there are more.',
    '# Hint: try clicking things multiple times.',
    '# Hint: try the dangerous commands.',
    'echo "Keep exploring..."'
  ],
  'projects': {
    'unfooled.md': [
      '# UnFooled',
      'Gamified critical thinking trainer built with Flutter.',
      'Status: Deployed',
      "Fun fact: Named after my frustration with misinformation."
    ],
    'android-file-xfer.md': [
      '# Android File Transfer',
      'macOS file manager over ADB. Built with PyQt6.',
      'Because the official Android File Transfer app is... inadequate.'
    ],
    'payslip-auto.md': [
      '# Payslip Auto',
      'PDF payslip generator + bulk email sender.',
      'Built with Streamlit. Saved HR hours of manual work.'
    ],
    'reviewai.md': [
      '# ReviewAI',
      'AI-powered question generator from uploaded documents.',
      'Built with Flask. Uses LLMs to create review materials.'
    ],
    'html-components.md': [
      '# Streamlit HTML Components',
      'Bridges HTML/CSS/JS into Streamlit apps.',
      'Published on PyPI. Because Streamlit needed more freedom.'
    ]
  },
  'experience': {
    'data-scientist-2025.log': [
      '[2025-present] Data Scientist',
      'Focus: LLMs, RAG, cybersecurity, PySpark',
      'Status: Currently building things that matter'
    ],
    'inchcape-digital.log': [
      '[2022-2025] Data Scientist @ Inchcape Digital',
      'Focus: ML models, data pipelines, LLM tools',
      'Highlight: Built ML models that actually made it to production',
      'Plot twist: Most of the job was cleaning data'
    ]
  },
  'secrets': {
    'passwords.txt': [
      'Honestly, I just use a password manager.',
      'What were you expecting to find here?',
      '',
      "...fine. The wifi password is 'stopsnooping'."
    ],
    'api-keys.txt': [
      'GITHUB_TOKEN=lol_this_is_definitely_not_real',
      'AWS_SECRET=nice_try_buddy_no_keys_here',
      'STRIPE_KEY=haha_no_stripe_here',
      '',
      '# If you\'re hunting for API keys in a static',
      '# portfolio site, consider a career in security.'
    ],
    'master-plan.txt': [
      'PHASE 1: Build portfolio on free tiers',
      'PHASE 2: ???',
      'PHASE 3: Profit',
      '',
      'Current status: Stuck on Phase 2'
    ]
  }
};

// Filesystem helpers
let fsCwd = []; // path segments relative to /home/visitor

function fsGetNode(segments) {
  let node = FS;
  for (let i = 0; i < segments.length; i++) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
    node = node[segments[i]];
  }
  return node !== undefined ? node : null;
}

function fsResolvePath(pathStr) {
  if (!pathStr || pathStr === '~') return [];
  let parts;
  if (pathStr.startsWith('/home/visitor/')) {
    parts = pathStr.slice('/home/visitor/'.length).split('/').filter(Boolean);
  } else if (pathStr.startsWith('/home/visitor')) {
    parts = [];
  } else if (pathStr.startsWith('~/')) {
    parts = pathStr.slice(2).split('/').filter(Boolean);
  } else if (pathStr === '/') {
    return null; // not allowed above home
  } else if (pathStr.startsWith('/')) {
    return null;
  } else {
    parts = fsCwd.concat(pathStr.split('/').filter(Boolean));
  }
  // Resolve . and ..
  const resolved = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '.') continue;
    if (parts[i] === '..') { resolved.pop(); continue; }
    resolved.push(parts[i]);
  }
  return resolved;
}

function fsIsDir(node) {
  return node && typeof node === 'object' && !Array.isArray(node);
}

function fsPromptPath() {
  return fsCwd.length === 0 ? '~' : '~/' + fsCwd.join('/');
}

function fsPromptHTML() {
  return '<span class="t-prompt-user">visitor@cj</span>:<span class="t-prompt-path">' + fsPromptPath() + '</span>$';
}

// ls -la metadata generator
function fsLsLong(node, name, isDir) {
  const perms = isDir ? 'drwxr-xr-x' : (name === '.env' ? '-rw-------' : (name.endsWith('.sh') ? '-rwxr-xr-x' : '-rw-r--r--'));
  const size = isDir ? '4096' : String(Array.isArray(node) ? node.join('\n').length : 64);
  const date = 'Mar 29 12:00';
  const display = isDir ? '<span class="t-cmd">' + name + '/</span>' : name;
  return perms + '  1 visitor visitor ' + size.padStart(5) + ' ' + date + ' ' + display;
}

const terminalCommands = {
  help: () => [
    'Available commands:',
    '',
    '  <span class="t-cmd">about</span>       Who is CJ?',
    '  <span class="t-cmd">skills</span>      Tech stack',
    '  <span class="t-cmd">projects</span>    Things I\'ve built',
    '  <span class="t-cmd">experience</span>  Work history',
    '  <span class="t-cmd">education</span>   Academic background',
    '  <span class="t-cmd">contact</span>     Get in touch',
    '  <span class="t-cmd">clear</span>       Clear terminal',
  ],
  about: () => {
    const node = fsGetNode(['about.txt']);
    return ['<span class="t-accent">CJ Carito</span> (Christian Joy C. Carito)', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'].concat(node ? node.slice(4) : []);
  },
  whoami: () => ['visitor'],
  skills: () => {
    const node = fsGetNode(['skills.json']);
    return node ? node.map(function (l) { return l; }) : [];
  },
  projects: () => [
    '<span class="t-accent">Featured Projects</span>',
    '━━━━━━━━━━━━━━━━━━━',
    '',
    '  UnFooled           Gamified critical thinking trainer (Flutter)',
    '  Android File Xfer  macOS file manager over ADB (PyQt6)',
    '  Payslip Auto       PDF payslips + bulk email (Streamlit)',
    '  ReviewAI           AI question generator from docs (Flask)',
    '  HTML Components    Bridges HTML/CSS/JS with Streamlit (PyPI)',
    '',
    '<span class="t-dim">Try: cd projects &amp;&amp; ls</span>'
  ],
  experience: () => [
    '<span class="t-accent">Work Experience</span>',
    '━━━━━━━━━━━━━━━━━',
    '',
    '  2025-present   Data Scientist',
    '                 LLMs, RAG, cybersecurity, PySpark',
    '',
    '  2022-2025      Data Scientist @ Inchcape Digital',
    '                 ML models, data pipelines, LLM tools',
    '',
    '<span class="t-dim">Try: cd experience &amp;&amp; ls</span>'
  ],
  work: () => terminalCommands.experience(),
  education: () => {
    const node = fsGetNode(['education.md']);
    return node ? node : [];
  },
  contact: () => {
    const node = fsGetNode(['contact.yml']);
    return node ? node : [];
  },
  // Filesystem commands
  pwd: () => ['/home/visitor' + (fsCwd.length ? '/' + fsCwd.join('/') : '')],
  cd: (args) => {
    if (!args || args === '~' || args === '~/' || args === '/home/visitor') {
      fsCwd = [];
      return [];
    }
    if (args === '-') return ['<span class="t-dim">OLDPWD not set</span>'];
    const resolved = fsResolvePath(args);
    if (resolved === null) return ['<span style="color:#f87171">cd: permission denied: cannot leave /home/visitor</span>'];
    const node = fsGetNode(resolved);
    if (node === null) return ['<span style="color:#f87171">cd: no such file or directory: ' + args + '</span>'];
    if (!fsIsDir(node)) return ['<span style="color:#f87171">cd: not a directory: ' + args + '</span>'];
    fsCwd = resolved;
    return [];
  },
  ls: (args) => {
    let target = fsCwd;
    let showHidden = false;
    let showLong = false;
    const flags = [];
    const paths = [];

    if (args) {
      args.split(/\s+/).forEach(function (a) {
        if (a.startsWith('-')) flags.push(a);
        else paths.push(a);
      });
    }
    flags.forEach(function (f) {
      if (f.indexOf('a') !== -1) showHidden = true;
      if (f.indexOf('l') !== -1) showLong = true;
    });

    if (paths.length > 0) {
      const resolved = fsResolvePath(paths[0]);
      if (resolved === null) return ['<span style="color:#f87171">ls: cannot access \'' + paths[0] + '\': Permission denied</span>'];
      const node = fsGetNode(resolved);
      if (node === null) return ['<span style="color:#f87171">ls: cannot access \'' + paths[0] + '\': No such file or directory</span>'];
      if (!fsIsDir(node)) {
        // It's a file — just show it
        return showLong ? [fsLsLong(node, paths[0].split('/').pop(), false)] : [paths[0].split('/').pop()];
      }
      target = resolved;
    }

    const node = fsGetNode(target);
    if (!node || !fsIsDir(node)) return ['<span style="color:#f87171">ls: not a directory</span>'];

    const entries = Object.keys(node).sort();
    const visible = showHidden ? entries : entries.filter(function (n) { return n[0] !== '.'; });

    if (showLong) {
      const lines = ['total ' + (visible.length * 4)];
      if (showHidden) {
        lines.push('drwxr-xr-x  ' + (Object.keys(node).length + 2) + ' visitor visitor  4096 Mar 29 12:00 <span class="t-cmd">.</span>');
        lines.push('drwxr-xr-x  3 visitor visitor  4096 Mar 29 12:00 <span class="t-cmd">..</span>');
      }
      visible.forEach(function (name) {
        const child = node[name];
        lines.push(fsLsLong(child, name, fsIsDir(child)));
      });
      return lines;
    }

    // Short format — columns
    const items = visible.map(function (name) {
      return fsIsDir(node[name]) ? '<span class="t-cmd">' + name + '/</span>' : name;
    });
    // Simple 3-column layout
    const cols = 3;
    const rows = [];
    for (let i = 0; i < items.length; i += cols) {
      rows.push(items.slice(i, i + cols).join('    '));
    }
    return rows;
  },
  cat: (args) => {
    if (!args) return ['Usage: cat &lt;filename&gt;'];
    const resolved = fsResolvePath(args);
    if (resolved === null) return ['<span style="color:#f87171">cat: ' + args + ': Permission denied</span>'];
    const node = fsGetNode(resolved);
    if (node === null) return ['<span style="color:#f87171">cat: ' + args + ': No such file or directory</span>'];
    if (fsIsDir(node)) return ['<span style="color:#f87171">cat: ' + args + ': Is a directory</span>'];
    return node;
  },
  head: (args) => {
    if (!args) return ['Usage: head &lt;filename&gt;'];
    const resolved = fsResolvePath(args);
    if (resolved === null) return ['<span style="color:#f87171">head: ' + args + ': Permission denied</span>'];
    const node = fsGetNode(resolved);
    if (node === null) return ['<span style="color:#f87171">head: ' + args + ': No such file or directory</span>'];
    if (fsIsDir(node)) return ['<span style="color:#f87171">head: ' + args + ': Is a directory</span>'];
    return node.slice(0, 5);
  },
  // Easter eggs
  sudo: (args) => {
    if (!args) return ['Usage: sudo &lt;command&gt;', '<span class="t-dim">[sudo] password for visitor:</span>'];
    return ['<span class="t-dim">[sudo] password for visitor: ******</span>', '<span class="t-dim">Sorry, try again.</span>'];
  },
  'rm -rf /': () => ['<span style="color:#f87171">rm: permission denied. Try with sudo.</span>'],
  'rm -rf': () => terminalCommands['rm -rf /'](),
  rm: () => ['<span style="color:#f87171">rm: cannot remove: Read-only file system</span>'],
  'sudo rm -rf /': '__MELTDOWN__',
  'sudo rm -rf': '__MELTDOWN__',
  hack: () => ['<span class="t-dim">Hack what? This runs on free tiers. There\'s nothing to steal.</span>'],
  exit: () => ['<span class="t-dim">You can\'t exit. You\'re in too deep. Type "help" instead.</span>'],
  date: () => [new Date().toLocaleString()],
  echo: (args) => [args || ''],
  ping: () => ['PONG! Site is alive and running on pure stubbornness.'],
  coffee: () => ['Brewing... CJ runs on caffeine and deadlines.'],
  neofetch: () => [
    '        <span class="t-accent">cj@portfolio</span>',
    '  ╭──╮  ──────────────',
    '  │<span class="t-cmd">CJ</span>│  <span class="t-accent">OS:</span>     Free Tiers & Stubbornness',
    '  ╰──╯  <span class="t-accent">Host:</span>   GitHub Pages',
    '         <span class="t-accent">Shell:</span>  Python 3.x',
    '         <span class="t-accent">CPU:</span>    Groq llama-3.1-8b',
    '         <span class="t-accent">RAM:</span>    Supabase Free Tier',
    '         <span class="t-accent">Uptime:</span> Somehow still running'
  ],
  vim: () => ['<span class="t-dim">You\'re stuck in vim. Just kidding. Type "help".</span>'],
  nano: () => ['<span class="t-dim">Read-only filesystem. Nice text editor though.</span>'],
  touch: () => ['<span style="color:#f87171">touch: cannot touch: Read-only file system</span>'],
  mkdir: () => ['<span style="color:#f87171">mkdir: cannot create directory: Read-only file system</span>'],
  chmod: () => ['<span class="t-dim">chmod: changing permissions of a static site? Bold.</span>'],
  wget: () => ['<span class="t-dim">wget: this terminal has no internet. It\'s decorative.</span>'],
  curl: () => ['<span class="t-dim">curl: same energy as wget. No network access here.</span>'],
  ssh: () => ['<span class="t-dim">ssh: connection refused. You\'re already inside.</span>'],
  apt: () => ['<span class="t-dim">E: This is not a real Debian system. Nice try.</span>'],
  brew: () => ['<span class="t-dim">brew: command not found. This isn\'t macOS either.</span>'],
  grep: (args) => {
    if (!args) return ['Usage: grep &lt;pattern&gt; &lt;file&gt;'];
    return ['<span class="t-dim">grep: try cat instead, this is a simple shell.</span>'];
  },
  find: () => ['<span class="t-dim">find: try "ls" and "cd" — you\'ll find what you need.</span>'],
  history: () => ['<span class="t-dim">Nice try. History is cleared on every session.</span>'],
  id: () => ['uid=1000(visitor) gid=1000(visitor) groups=1000(visitor)'],
  uname: () => ['Linux cj-portfolio 6.1.0-free-tier #1 SMP x86_64 GNU/Linux'],
  hostname: () => ['cj-portfolio'],
  uptime: () => ['up ' + Math.floor((Date.now() - performance.timeOrigin) / 1000) + ' seconds, 1 user, load average: 0.00, 0.01, 0.05'],
  man: (args) => {
    if (!args) return ['What manual page do you want?'];
    return ['<span class="t-dim">No manual entry for ' + args + '. Try "help".</span>'];
  },
  '': () => []
};

function meltdown(addLine, input, termBody) {
  input.disabled = true;

  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const scroll = () => { termBody.scrollTop = termBody.scrollHeight; };
  const type = (html, cls) => { addLine(html, cls); scroll(); };

  // Sections to "delete"
  const targets = [
    { sel: '.hero', name: '/home/visitor/hero' },
    { sel: '#about', name: '/home/visitor/about' },
    { sel: '.projects-grid', name: '/home/visitor/projects' },
    { sel: '.gh-card', name: '/home/visitor/github-activity' },
    { sel: '.terminal-row', name: '/home/visitor/terminal' },
    { sel: '.footer', name: '/home/visitor/footer' },
    { sel: '.navbar', name: '/home/visitor/navbar' },
  ];

  (async function run() {
    type('<span class="t-dim">[sudo] password for visitor: ******</span>');
    await delay(600);
    type('<span class="t-accent">authenticated.</span>');
    await delay(400);
    type('');
    type('<span style="color:#f87171">rm: descending into \'/\'...</span>');
    await delay(800);

    // Create screen overlay for glitch effects
    const overlay = document.createElement('div');
    overlay.className = 'meltdown-overlay';
    document.body.appendChild(overlay);

    // Delete elements one by one
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const el = document.querySelector(t.sel);
      await delay(400);
      type('<span style="color:#f87171">rm: removing ' + t.name + '...</span>');

      if (el) {
        el.classList.add('meltdown-delete');
        await delay(300);
        el.style.display = 'none';
        el.classList.remove('meltdown-delete');
      }

      // Flicker overlay occasionally
      if (i % 2 === 0) {
        overlay.classList.add('meltdown-flicker');
        await delay(150);
        overlay.classList.remove('meltdown-flicker');
      }
    }

    await delay(500);
    type('');
    type('<span style="color:#f87171">rm: cannot remove \'/proc/self\': Operation not permitted</span>');
    await delay(300);
    type('<span style="color:#f87171">rm: cannot remove \'/sys/kernel\': Permission denied</span>');
    await delay(400);
    type('');
    type('<span style="color:#fbbf24">WARNING: critical system files removed</span>');
    await delay(600);

    // Full screen glitch
    overlay.classList.add('meltdown-glitch');
    await delay(200);
    overlay.classList.remove('meltdown-glitch');
    await delay(100);
    overlay.classList.add('meltdown-glitch');
    await delay(150);
    overlay.classList.remove('meltdown-glitch');

    await delay(400);
    type('<span style="color:#f87171">Segmentation fault (core dumped)</span>');
    await delay(300);
    type('<span style="color:#f87171">KERNEL PANIC - not syncing: Attempted to kill init!</span>');

    // Black out
    overlay.classList.add('meltdown-blackout');
    await delay(2000);

    // Restore everything
    targets.forEach(function (t) {
      const el = document.querySelector(t.sel);
      if (el) el.style.display = '';
    });

    // Fade back in
    overlay.classList.remove('meltdown-blackout');
    overlay.classList.add('meltdown-restore');
    await delay(800);

    overlay.remove();

    // Clear terminal and show aftermath message
    const outputEl = document.getElementById('terminal-output');
    if (outputEl) outputEl.innerHTML = '';
    type('');
    type('<span class="t-accent">System restored from backup.</span>');
    type('');
    type('<span class="t-dim">Nice try. Everything here runs on GitHub Pages.</span>');
    type('<span class="t-dim">You can\'t kill what\'s already statically hosted.</span>');
    type('');

    input.disabled = false;
    input.focus();
  })();
}

(function initTerminal() {
  const input = document.getElementById('terminal-input');
  const output = document.getElementById('terminal-output');
  const body = document.getElementById('terminal-body');
  if (!input || !output || !body) return;

  const history = [];
  let histIdx = -1;
  const promptEl = document.querySelector('.terminal-prompt');

  function updatePrompt() {
    if (promptEl) {
      promptEl.innerHTML = '<span class="t-prompt-user">visitor@cj</span>:<span class="t-prompt-path">' + fsPromptPath() + '</span>$';
    }
  }

  function addLine(html, className) {
    const line = document.createElement('div');
    line.className = 'terminal-line' + (className ? ' ' + className : '');
    line.innerHTML = html;
    output.appendChild(line);
  }

  function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    history.unshift(trimmed);
    histIdx = -1;

    // Echo command with current prompt
    addLine(fsPromptHTML() + ' ' + sanitize(trimmed), 't-command');

    if (trimmed.toLowerCase() === 'clear') {
      output.innerHTML = '';
      return;
    }

    const parts = trimmed.toLowerCase().split(/\s+/);
    const base = parts[0];
    const args = parts.slice(1).join(' ');

    const handler = terminalCommands[trimmed.toLowerCase()] || terminalCommands[base];
    if (handler === '__MELTDOWN__') {
      meltdown(addLine, input, body);
      return;
    }
    if (handler) {
      const lines = typeof handler === 'function' ? handler(args) : handler;
      if (Array.isArray(lines)) lines.forEach(l => addLine(l));
    } else {
      addLine(`command not found: ${sanitize(base)}. Type <span class="t-cmd">help</span> for available commands.`);
    }

    // Update prompt after command (cd may have changed cwd)
    updatePrompt();
    body.scrollTop = body.scrollHeight;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      runCommand(input.value);
      input.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) {
        histIdx++;
        input.value = history[histIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) {
        histIdx--;
        input.value = history[histIdx];
      } else {
        histIdx = -1;
        input.value = '';
      }
    }
  });

  document.querySelector('.terminal')?.addEventListener('click', () => input.focus());
})();

// ========== GitHub Activity Grid ==========
(async function initGitHubGrid() {
  const grid = document.getElementById('gh-grid');
  const statsEl = document.getElementById('gh-stats');
  if (!grid) return;

  try {
    const res = await fetch('contributions.json');
    if (!res.ok) return;
    const data = await res.json();

    // Show last 20 weeks of the contribution calendar
    const displayWeeks = data.weeks.slice(-20);

    displayWeeks.forEach(week => {
      week.forEach(day => {
        const cell = document.createElement('div');
        const count = day.count;
        const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 8 ? 3 : 4;
        cell.className = `gh-cell gh-level-${level}`;
        cell.title = `${day.date}: ${count} contribution${count !== 1 ? 's' : ''}`;
        grid.appendChild(cell);
      });
    });

    // Stats
    if (statsEl) {
      const allDays = data.weeks.flat();
      const activeDays = allDays.filter(d => d.count > 0).length;
      statsEl.innerHTML =
        `<span><span class="gh-stat-val">${data.total}</span> contributions this year</span>` +
        `<span><span class="gh-stat-val">${activeDays}</span> active days</span>`;
    }
  } catch { /* silent */ }
})();

// ========== Status Widget ==========
(async function initStatusWidget() {
  const stat = document.getElementById('sw-stat');
  const cpStat = document.getElementById('cp-stat');
  if (!stat) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?select=id`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    if (!res.ok) return;
    const total = res.headers.get('content-range')?.split('/')?.pop();
    if (total) {
      const text = `${total} messages processed`;
      stat.textContent = text;
      if (cpStat) cpStat.textContent = text;
    }
  } catch { /* silent */ }
})();

// ========== Contact Panel Toggle ==========
const contactPanel = document.getElementById('contact-panel');
const statusWidget = document.getElementById('status-widget');
const cpClose = document.getElementById('cp-close');

function toggleContactPanel(forceOpen) {
  const isOpen = contactPanel.classList.contains('open');
  if (forceOpen === true && isOpen) return;
  if (forceOpen === false && !isOpen) return;

  contactPanel.classList.toggle('open');
  statusWidget.classList.toggle('panel-open');
}

statusWidget.addEventListener('click', () => toggleContactPanel());
cpClose.addEventListener('click', () => toggleContactPanel(false));

// Close panel on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && contactPanel.classList.contains('open')) {
    toggleContactPanel(false);
  }
});

// Close panel when clicking outside
document.addEventListener('click', (e) => {
  if (contactPanel.classList.contains('open') &&
      !contactPanel.contains(e.target) &&
      !statusWidget.contains(e.target) &&
      !e.target.closest('a[href="#contact"]')) {
    toggleContactPanel(false);
  }
});

// ========== Smooth Scroll for Nav Links ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');

    // Contact link toggles the panel instead of scrolling
    if (href === '#contact') {
      e.preventDefault();
      toggleContactPanel(true);
      // Close mobile nav if open
      const navLinks = document.getElementById('nav-links');
      const navToggle = document.getElementById('nav-toggle');
      if (navLinks && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        navToggle.classList.remove('open');
      }
      return;
    }

    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ========== Window Traffic Light Controls ==========
function setupTrafficLights(dotsContainer, target) {
  const red = dotsContainer.querySelector('.wdot-red');
  const yellow = dotsContainer.querySelector('.wdot-yellow');
  const green = dotsContainer.querySelector('.wdot-green');
  if (!red || !yellow || !green) return;

  red.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    target.classList.remove('minimized');
    target.classList.add('closed');
    setTimeout(checkAllClosed, 400);
  });

  yellow.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (target.classList.contains('minimized')) {
      target.classList.remove('minimized');
    } else {
      target.classList.add('minimized');
    }
  });

  green.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    target.classList.remove('minimized');
    target.classList.remove('closed');
    checkAllClosed();
  });
}

// Project cards
document.querySelectorAll('.window-bar').forEach(bar => {
  const card = bar.closest('.project-card');
  if (!card) return;
  setupTrafficLights(bar, card);
});

// Terminal
const terminalDots = document.querySelector('.terminal-dots');
const terminalEl = document.querySelector('.terminal');
if (terminalDots && terminalEl) {
  setupTrafficLights(terminalDots, terminalEl);
}

// Check if all project items are closed
function checkAllClosed() {
  const cards = document.querySelectorAll('.project-card');
  const grid = document.querySelector('.projects-grid');
  const tRow = document.querySelector('.terminal-row');
  const empty = document.getElementById('projects-empty');
  const allCardsClosed = Array.from(cards).every(c => c.classList.contains('closed'));
  const termClosed = terminalEl && terminalEl.classList.contains('closed');

  const subtitle = document.querySelector('#projects .section-subtitle');
  if (allCardsClosed && termClosed) {
    grid.style.display = 'none';
    tRow.style.display = 'none';
    if (subtitle) subtitle.style.display = 'none';
    empty.classList.add('visible');
  } else {
    grid.style.display = '';
    tRow.style.display = '';
    if (subtitle) subtitle.style.display = '';
    empty.classList.remove('visible');
  }
}

// ========== Snake Easter Egg ==========
(function initSnakeEasterEgg() {
  const card = document.querySelector('.gh-card');
  if (!card) return;

  const grid = document.getElementById('gh-grid');
  const legend = card.querySelector('.gh-legend');
  const stats = document.getElementById('gh-stats');
  const headerText = card.querySelector('.gh-panel-header span');
  if (!grid) return;

  const ROWS = 7;
  const TICK_MS = 170;
  const CLICKS_NEEDED = 5;
  const CLICK_WINDOW = 2000;

  let clickTimes = [];
  let gameActive = false;

  card.addEventListener('click', function (e) {
    if (gameActive) return;
    if (e.target.closest('.window-bar')) return;

    const now = Date.now();
    clickTimes.push(now);
    clickTimes = clickTimes.filter(t => now - t < CLICK_WINDOW);
    if (clickTimes.length >= CLICKS_NEEDED) {
      clickTimes = [];
      startGame();
    }
  });

  function startGame() {
    const cells = Array.from(grid.querySelectorAll('.gh-cell'));
    if (cells.length < ROWS) return;

    const totalCells = cells.length;
    const COLS = totalCells / ROWS;
    if (COLS !== Math.floor(COLS)) return;

    gameActive = true;

    // Save original state
    const originalLevels = cells.map(function (c) {
      for (let l = 4; l >= 0; l--) {
        if (c.classList.contains('gh-level-' + l)) return l;
      }
      return 0;
    });
    const originalStats = stats ? stats.innerHTML : '';
    const originalHeader = headerText ? headerText.textContent : '';

    // col-major index (grid-auto-flow: column)
    const idx = function (col, row) { return col * ROWS + row; };

    // Count food (green cells)
    let foodTotal = 0;
    for (let i = 0; i < totalCells; i++) {
      if (originalLevels[i] > 0) foodTotal++;
    }

    // Start on an empty cell near left
    let sc = 1, sr = 3;
    if (originalLevels[idx(sc, sr)] > 0) {
      for (let c = 0; c < COLS; c++) {
        let found = false;
        for (let r = 0; r < ROWS; r++) {
          if (originalLevels[idx(c, r)] === 0) { sc = c; sr = r; found = true; break; }
        }
        if (found) break;
      }
    }

    let snake = [{ c: sc, r: sr }];
    let dir = { c: 1, r: 0 };
    let nextDir = { c: 1, r: 0 };
    let score = 0;
    let eaten = new Set();

    // Update UI
    if (headerText) headerText.textContent = 'Snake';
    if (legend) legend.style.display = 'none';
    if (stats) stats.innerHTML =
      '<span class="gh-snake-status">' +
        '<span class="gh-snake-score">0</span> / ' + foodTotal + ' eaten — arrow keys to play' +
      '</span>';

    grid.classList.add('gh-snake-active');
    render();

    function onKey(e) {
      switch (e.key) {
        case 'ArrowUp': case 'w': if (dir.r !== 1) nextDir = { c: 0, r: -1 }; break;
        case 'ArrowDown': case 's': if (dir.r !== -1) nextDir = { c: 0, r: 1 }; break;
        case 'ArrowLeft': case 'a': if (dir.c !== 1) nextDir = { c: -1, r: 0 }; break;
        case 'ArrowRight': case 'd': if (dir.c !== -1) nextDir = { c: 1, r: 0 }; break;
        default: return;
      }
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);

    const interval = setInterval(tick, TICK_MS);

    function tick() {
      dir = { c: nextDir.c, r: nextDir.r };
      const head = snake[snake.length - 1];
      const nh = {
        c: (head.c + dir.c + COLS) % COLS,
        r: (head.r + dir.r + ROWS) % ROWS
      };

      // Self collision
      if (snake.some(function (s) { return s.c === nh.c && s.r === nh.r; })) {
        endGame(false);
        return;
      }

      snake.push(nh);

      const ci = idx(nh.c, nh.r);
      if (originalLevels[ci] > 0 && !eaten.has(ci)) {
        eaten.add(ci);
        score++;
        const scoreEl = card.querySelector('.gh-snake-score');
        if (scoreEl) scoreEl.textContent = score;
        if (score >= foodTotal) { endGame(true); return; }
      } else {
        snake.shift();
      }

      render();
    }

    function render() {
      for (let i = 0; i < totalCells; i++) {
        cells[i].classList.remove('gh-snake-head', 'gh-snake-body');
        if (eaten.has(i)) {
          cells[i].className = cells[i].className.replace(/gh-level-\d/, 'gh-level-0');
        }
      }
      for (let i = 0; i < snake.length; i++) {
        const ci = idx(snake[i].c, snake[i].r);
        cells[ci].classList.add(i === snake.length - 1 ? 'gh-snake-head' : 'gh-snake-body');
      }
    }

    function endGame(won) {
      clearInterval(interval);
      document.removeEventListener('keydown', onKey);

      if (won) {
        // Victory flash — all cells turn green briefly
        for (let i = 0; i < totalCells; i++) {
          cells[i].classList.remove('gh-snake-head', 'gh-snake-body');
          cells[i].classList.add('gh-snake-body');
        }
      } else {
        // Flash head red on death
        const hi = idx(snake[snake.length - 1].c, snake[snake.length - 1].r);
        cells[hi].classList.add('gh-snake-dead');
      }

      if (stats) {
        stats.innerHTML = won
          ? '<span class="gh-snake-status">All commits devoured!</span>'
          : '<span class="gh-snake-status">Game over — ' + score + ' / ' + foodTotal + ' eaten</span>';
      }

      // Restore after delay
      setTimeout(function () {
        for (let i = 0; i < totalCells; i++) {
          cells[i].classList.remove('gh-snake-head', 'gh-snake-body', 'gh-snake-dead');
          cells[i].className = cells[i].className.replace(/gh-level-\d/, 'gh-level-' + originalLevels[i]);
        }
        grid.classList.remove('gh-snake-active');
        if (legend) legend.style.display = '';
        if (stats) stats.innerHTML = originalStats;
        if (headerText) headerText.textContent = originalHeader;
        gameActive = false;
      }, 3000);
    }
  }
})();

// Restore All button
document.getElementById('projects-restore').addEventListener('click', () => {
  document.querySelectorAll('.project-card').forEach(c => {
    c.classList.remove('closed', 'minimized');
  });
  if (terminalEl) terminalEl.classList.remove('closed', 'minimized');
  checkAllClosed();
});
