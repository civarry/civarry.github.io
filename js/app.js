// ========== Supabase Configuration ==========
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
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to insert: ${response.statusText}`);
    }

    return true;
  }
};

// ========== Typing Animation ==========
const phrases = [
  'automation tools.',
  'AI applications.',
  'things that should exist.',
  'solutions to problems I hate.',
  'open-source libraries.',
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
    // Don't send status — enforced by DB default + RLS policy
    await supabase.insert('messages', {
      name: name,
      email: email,
      message: message
    });

    recordSubmission();

    formStatus.textContent = 'Message sent! I\'ll get back to you soon.';
    formStatus.className = 'form-status success';
    form.reset();
    if (charCount) charCount.textContent = '0 / 2000';

  } catch (error) {
    formStatus.textContent = 'Something went wrong. Please try again.';
    formStatus.className = 'form-status error';
  }

  submitBtn.disabled = false;
  submitBtn.classList.remove('loading');
});

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
