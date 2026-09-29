// Quote cards — hover to see details, tap on touch devices, prefill the request form.
// Repair request form — submits to Netlify's form handling without leaving the page.

function parseServiceLabel(label) {
  const tierMatch = label.match(/^(.*)\s\(([^)]+)\)$/);
  if (tierMatch) {
    return { issue: tierMatch[1].trim(), tier: tierMatch[2].trim() };
  }
  return { issue: label };
}

function initQuoteCards() {
  const container = document.querySelector('[data-quote-cards]');
  if (!container) return;

  const cards = container.querySelectorAll('.quote-card');

  cards.forEach((card) => {
    const toggle = card.querySelector('.quote-card-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const isRevealed = card.classList.toggle('is-revealed');
      toggle.setAttribute('aria-expanded', String(isRevealed));

      // Only one card open at a time on touch, so the details are always easy to spot.
      if (isRevealed) {
        cards.forEach((other) => {
          if (other !== card) {
            other.classList.remove('is-revealed');
            other.querySelector('.quote-card-toggle')?.setAttribute('aria-expanded', 'false');
          }
        });
      }
    });
  });

  container.addEventListener('click', (event) => {
    const bookLink = event.target.closest('[data-book-service]');
    if (!bookLink) return;

    const { issue, tier } = parseServiceLabel(bookLink.dataset.bookService);

    const issueSelect = document.getElementById('rf-issue');
    if (issueSelect) {
      const hasOption = Array.from(issueSelect.options).some((opt) => opt.value === issue);
      issueSelect.value = hasOption ? issue : 'Something else';
    }

    if (tier) {
      const detailsField = document.getElementById('rf-details');
      if (detailsField && !detailsField.value) {
        detailsField.value = `Tier interested in: ${tier}`;
      }
    }
  });
}

function initRepairForm() {
  const form = document.getElementById('repair-form');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Sent as FormData (not URL-encoded) so the optional photo upload comes through —
    // the browser sets the multipart boundary header itself, so don't set Content-Type here.
    const data = new FormData(form);

    try {
      await fetch('/', {
        method: 'POST',
        body: data,
      });

      form.reset();
      if (status) {
        status.textContent =
          "Got it — we'll text or call you back shortly to confirm pricing and pickup.";
        status.hidden = false;
      }
    } catch (err) {
      if (status) {
        status.textContent =
          'Something went wrong sending that — please call or text us instead.';
        status.hidden = false;
      }
    }
  });
}

initQuoteCards();
initRepairForm();