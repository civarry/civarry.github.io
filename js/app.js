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

// ========== Navbar Scroll Effect ==========
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
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
  { key: 'ai_drafting', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2 1 3.5 2 4.5L4 17v2h16v-2l-6-6.5c1-1 2-2.5 2-4.5a4 4 0 0 0-4-4z"/><circle cx="12" cy="6" r="1"/></svg>', label: 'AI Analyzing', desc: 'Reading your message' },
  { key: 'notifying', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>', label: 'CJ Notified', desc: 'Sent to Telegram' },
  { key: 'sending_reply', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7L13.03 12.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>', label: 'Sending Reply', desc: 'Drafting your email' },
  { key: 'replied', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>', label: 'Reply Sent', desc: 'Check your inbox' }
];

const STATUS_ORDER = ['pending', 'received', 'ai_drafting', 'notifying', 'sending_reply', 'replied', 'done'];

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
          <div class="step-connector"><div class="connector-fill"></div></div>
          <div class="step-node">
            <div class="step-icon-ring">
              <span class="step-icon material-icons">${step.icon}</span>
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
      <p>A personalized reply has been sent to <strong>${sanitize(userEmail)}</strong></p>
    </div>
  `;

  form.style.display = 'none';
  form.parentNode.insertBefore(pipeline, form.nextSibling);

  setTimeout(() => pipeline.classList.add('visible'), 50);

  let currentIndex = -1;

  const pollStatus = setInterval(async () => {
    const status = await supabase.getStatus(messageId);
    if (!status) return;

    const statusIndex = STATUS_ORDER.indexOf(status);
    if (statusIndex <= currentIndex) return;

    // Activate all steps up to current status
    for (let i = currentIndex + 1; i <= Math.min(statusIndex - 1, PIPELINE_STEPS.length - 1); i++) {
      activateStep(pipeline, i);
    }
    currentIndex = statusIndex - 1;

    if (status === 'replied' || status === 'done') {
      // Complete all remaining steps
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        activateStep(pipeline, i);
      }
      clearInterval(pollStatus);

      const footer = pipeline.querySelector('.pipeline-footer');
      const header = pipeline.querySelector('.pipeline-header p');
      setTimeout(() => {
        header.textContent = status === 'replied' ? 'All done!' : 'Message processed!';
        pipeline.querySelector('.pipeline-icon-pulse').classList.add('complete');
        if (status === 'replied') footer.style.display = 'block';
      }, 600);
    }
  }, 2000);

  // Timeout after 60s
  setTimeout(() => {
    clearInterval(pollStatus);
    const header = pipeline.querySelector('.pipeline-header p');
    if (!header.textContent.includes('done')) {
      header.textContent = 'This is taking longer than usual. You\'ll still get a reply via email.';
    }
  }, 60000);
}

function activateStep(pipeline, index) {
  const step = pipeline.querySelector(`[data-index="${index}"]`);
  if (!step || step.classList.contains('active')) return;
  setTimeout(() => {
    step.classList.add('active');
    setTimeout(() => step.classList.add('completed'), 400);
  }, index * 150);
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

// ========== Smooth Scroll for Nav Links ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
