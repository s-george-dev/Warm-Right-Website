const steps = [
  'Your Details',
  'Your Engineer',
  'Your Insurer/Agent',
  'Final Remarks',
  'Review',
  'Submit',
];

let currentStep = 0;

const form = document.getElementById('feedback-form');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('feedbackStatus');

function initFeedbackSurvey() {
  applyQueryParams();
  bindAddressFinder();
  document.querySelectorAll('[data-step-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = Number(tab.dataset.stepTab);
      if (target <= currentStep || validateThrough(target)) showStep(target);
    });
  });
  backBtn.addEventListener('click', () => showStep(Math.max(0, currentStep - 1)));
  nextBtn.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (currentStep === 3) buildReview();
    showStep(Math.min(steps.length - 1, currentStep + 1));
  });
  form.addEventListener('submit', submitFeedback);
  showStep(0);
}

function applyQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const map = {
    name: 'customer_name',
    email: 'customer_email',
    phone: 'customer_phone',
    job: 'job_number',
    address: 'customer_address',
    source: 'source',
  };
  Object.entries(map).forEach(([queryKey, fieldId]) => {
    const value = params.get(queryKey);
    if (value && document.getElementById(fieldId)) {
      document.getElementById(fieldId).value = value;
    }
  });
  if (params.get('from') === 'testimonial') {
    document.getElementById('source').value = 'testimonial';
  }
}

function bindAddressFinder() {
  if (!window.google?.maps?.places && window.WARMRIGHT_GOOGLE_MAPS_API_KEY) {
    window.initFeedbackAddressFinder = bindAddressFinder;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(window.WARMRIGHT_GOOGLE_MAPS_API_KEY)}&libraries=places&callback=initFeedbackAddressFinder`;
    script.async = true;
    document.head.appendChild(script);
    return;
  }

  const input = document.getElementById('customer_address');
  if (!window.google?.maps?.places || !input) return;

  const autocomplete = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: 'gb' },
    fields: ['formatted_address', 'name'],
    types: ['address'],
  });
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    input.value = place.formatted_address || place.name || input.value;
  });
}

function showStep(index) {
  currentStep = index;
  document.querySelectorAll('.survey-step').forEach((step) => {
    step.classList.toggle('active', Number(step.dataset.step) === currentStep);
  });
  document.querySelectorAll('[data-step-tab]').forEach((tab) => {
    tab.classList.toggle('active', Number(tab.dataset.stepTab) === currentStep);
  });
  const percent = Math.round(((currentStep + 1) / steps.length) * 100);
  document.getElementById('progressLabel').textContent = steps[currentStep];
  document.getElementById('progressPercent').textContent = `${percent}%`;
  document.getElementById('progressFill').style.width = `${percent}%`;
  backBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
  nextBtn.style.display = currentStep >= 5 ? 'none' : 'inline-flex';
  submitBtn.style.display = currentStep === 5 ? 'inline-flex' : 'none';
  if (currentStep === 4) buildReview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateThrough(targetStep) {
  const original = currentStep;
  for (let index = currentStep; index < targetStep; index += 1) {
    currentStep = index;
    if (!validateCurrentStep()) {
      currentStep = original;
      return false;
    }
  }
  currentStep = original;
  return true;
}

function validateCurrentStep() {
  const step = document.querySelector(`.survey-step[data-step="${currentStep}"]`);
  const fields = step.querySelectorAll('input, textarea, select');
  let valid = true;
  fields.forEach((field) => {
    const required = field.required;
    const isRadio = field.type === 'radio';
    let filled = true;
    if (required && isRadio) {
      filled = Boolean(form.querySelector(`input[name="${field.name}"]:checked`));
    } else if (required) {
      filled = Boolean(field.value.trim());
    }
    field.toggleAttribute('aria-invalid', !filled);
    if (!filled) valid = false;
  });
  if (!valid) {
    statusEl.style.color = '#dc2626';
    statusEl.textContent = 'Please complete the required fields before continuing.';
  } else {
    statusEl.textContent = '';
  }
  return valid;
}

function buildReview() {
  const labels = {
    customer_name: 'Name',
    customer_email: 'Email',
    customer_phone: 'Phone',
    job_number: 'Job Number',
    customer_address: 'Address',
    engineer_name: 'Engineer',
    engineer_communication: 'Engineer Communication',
    engineer_experience: 'Engineer Overall Experience',
    engineer_comments: 'Engineer Comments',
    insurer_agent_name: 'Insurer/Agent/Landlord',
    main_body_communication: 'Main Body Communication',
    main_body_experience: 'Main Body Overall Experience',
    main_body_comments: 'Main Body Comments',
    final_remarks: 'Final Remarks',
    wants_contact: 'Customer Service Contact',
  };
  const summary = document.getElementById('reviewSummary');
  const data = new FormData(form);
  summary.innerHTML = '';
  Object.entries(labels).forEach(([key, label]) => {
    const value = data.get(key);
    if (!value) return;
    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(formatReviewValue(key, value))}</span>`;
    summary.appendChild(item);
  });
}

function formatReviewValue(key, value) {
  if (key === 'wants_contact') return value === 'yes' ? 'Yes' : 'No';
  if (key.includes('communication') || key.includes('experience')) return `${value}/5`;
  return value;
}

async function submitFeedback(event) {
  event.preventDefault();
  if (!validateCurrentStep()) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  statusEl.style.color = '#123b75';
  statusEl.textContent = 'Sending your feedback...';

  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  payload.wants_contact = data.get('wants_contact') === 'yes';

  const { error } = await window.db.functions.invoke('feedback-submission', { body: payload });
  if (error) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Feedback';
    statusEl.style.color = '#dc2626';
    statusEl.textContent = await getFunctionErrorMessage(error);
    return;
  }

  document.getElementById('submitState').classList.add('success');
  document.getElementById('submitState').innerHTML = '<h2>Thank you for submitting</h2><p>Your feedback has been sent to the Warm Right team.</p>';
  statusEl.style.color = '#166534';
  statusEl.textContent = 'Thank you for submitting your feedback.';
  submitBtn.style.display = 'none';
}

async function getFunctionErrorMessage(error) {
  const fallback = error?.message || 'Sorry, we could not send your feedback. Please email info@warmright.uk.';
  try {
    const context = error.context;
    if (!context) return fallback;
    const text = await context.clone().text();
    const json = JSON.parse(text);
    return json.error || fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

window.initFeedbackSurvey = initFeedbackSurvey;
document.addEventListener('DOMContentLoaded', initFeedbackSurvey);
