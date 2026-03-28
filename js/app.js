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
    '',
    '<span class="t-dim">Try some hidden commands too...</span>'
  ],
  about: () => [
    '<span class="t-accent">CJ Carito</span> (Christian Joy C. Carito)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Data Scientist & Developer from Quezon City, PH.',
    '',
    'I find problems that annoy me, then build things to fix them.',
    'Python-first, but I\'ll use whatever the problem needs.',
    '',
    '3+ years in tech — ML, LLMs, and building things that',
    'probably shouldn\'t be running on free tiers.',
  ],
  whoami: () => terminalCommands.about(),
  skills: () => [
    '<span class="t-accent">Tech Stack</span>',
    '━━━━━━━━━━━━━',
    '',
    '  Languages    Python, SQL, JavaScript, Dart',
    '  Frameworks   Flask, Django, ReactJS, Streamlit, Flutter',
    '  AI/ML        TensorFlow, Scikit-learn, LLMs, RAG, NLP',
    '  Data         PySpark, Pandas, Databricks',
    '  Backend      Supabase, GitHub Actions, REST APIs',
    '  Tools        Git, Linux, Docker',
    '',
    '<span class="t-dim">If it solves the problem, I\'ll learn it.</span>'
  ],
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
    '<span class="t-dim">Scroll down or type "contact" to discuss ideas.</span>'
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
    '<span class="t-dim">3+ years building ML models, data pipelines, and AI tools.</span>'
  ],
  work: () => terminalCommands.experience(),
  education: () => [
    '<span class="t-accent">Education</span>',
    '━━━━━━━━━━━━',
    '',
    '  BS Computer Science',
    '  Our Lady of Fatima University',
    '  2019 - 2023'
  ],
  contact: () => [
    '<span class="t-accent">Get In Touch</span>',
    '━━━━━━━━━━━━━━',
    '',
    '  GitHub     github.com/civarry',
    '  LinkedIn   linkedin.com/in/cccarito',
    '',
    '<span class="t-dim">Or scroll down — the contact form has a cool pipeline viz.</span>'
  ],
  // Easter eggs
  sudo: () => ['<span class="t-dim">Nice try. You don\'t have permission here.</span>'],
  'rm -rf /': () => ['<span class="t-dim">Whoa. This is a portfolio, not a sandbox.</span>'],
  'rm -rf': () => terminalCommands['rm -rf /'](),
  hack: () => ['<span class="t-dim">Hack what? This runs on free tiers. There\'s nothing to steal.</span>'],
  exit: () => ['<span class="t-dim">You can\'t exit. You\'re in too deep. Type "help" instead.</span>'],
  ls: () => [
    'about.txt    skills.json    projects/',
    'experience/  education.md   contact.yml',
    '<span class="t-dim">secrets/     .env</span>           easter_eggs.sh'
  ],
  pwd: () => ['/home/visitor/cj-portfolio'],
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
  cat: (args) => {
    if (!args) return ['Usage: cat <filename>'];
    if (args.includes('secret') || args.includes('.env'))
      return ['<span class="t-dim">Permission denied. Nice try though.</span>'];
    return ['<span class="t-dim">No such file. Try "ls" to see what\'s here.</span>'];
  },
  vim: () => ['<span class="t-dim">You\'re stuck in vim. Just kidding. Type "help".</span>'],
  '': () => []
};

(function initTerminal() {
  const input = document.getElementById('terminal-input');
  const output = document.getElementById('terminal-output');
  const body = document.getElementById('terminal-body');
  if (!input || !output || !body) return;

  const history = [];
  let histIdx = -1;

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

    addLine(sanitize(trimmed), 't-command');

    if (trimmed.toLowerCase() === 'clear') {
      output.innerHTML = '';
      return;
    }

    const parts = trimmed.toLowerCase().split(/\s+/);
    const base = parts[0];
    const args = parts.slice(1).join(' ');

    const handler = terminalCommands[trimmed.toLowerCase()] || terminalCommands[base];
    if (handler) {
      const lines = typeof handler === 'function' ? handler(args) : handler;
      if (Array.isArray(lines)) lines.forEach(l => addLine(l));
    } else {
      addLine(`command not found: ${sanitize(base)}. Type <span class="t-cmd">help</span> for available commands.`);
    }

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
