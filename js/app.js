// ========== Supabase Configuration ==========
// Replace these with your actual Supabase project values
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// ========== Supabase Client (lightweight, no SDK needed) ==========
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

// ========== Contact Form Handler ==========
const form = document.getElementById('contact-form');
const submitBtn = document.getElementById('submit-btn');
const formStatus = document.getElementById('form-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Get form data
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();

  if (!name || !email || !message) return;

  // Disable button while sending
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  formStatus.className = 'form-status';

  try {
    // Write to Supabase — Streamlit backend will pick this up
    await supabase.insert('messages', {
      name: name,
      email: email,
      message: message,
      status: 'pending'
    });

    // Show success
    formStatus.textContent = 'Message sent! I\'ll get back to you soon.';
    formStatus.className = 'form-status success';
    form.reset();

  } catch (error) {
    console.error('Error:', error);
    formStatus.textContent = 'Something went wrong. Try again later.';
    formStatus.className = 'form-status error';
  }

  // Re-enable button
  submitBtn.disabled = false;
  submitBtn.textContent = 'Send Message';
});

// ========== Smooth scroll for nav links ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
