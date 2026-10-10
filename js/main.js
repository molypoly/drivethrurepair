// Quote cards — hover to see details, tap on touch devices, prefill the request form.
// Repair request form — submits to Netlify's form handling without leaving the page.

// Google Maps Places API key — create a Google Cloud project with billing
// enabled, enable "Places API (New)" for it, then create an API key
// restricted to this site's domain (HTTP referrer restriction) and to that
// one API. Paste the key below. Until a real key is set, the address field
// just works as a plain text input — no errors, no autocomplete, no script
// ever gets loaded.
const GOOGLE_MAPS_API_KEY = 'AIzaSyB7W0xJaTd6dDDeq2YJvyWEVo1O1WhquaU';

// Simple client-side cooldown so someone can't fire off the repair-request
// form over and over — this is a politeness/anti-double-submit measure,
// not real spam protection (it lives in localStorage, so it's specific to
// one browser and easy to clear). Real abuse protection — and the only
// thing that actually caps Google Places API costs, since autocomplete
// fires while typing, not on submit — is a daily quota cap set on the API
// itself in Google Cloud Console.
const SUBMIT_COOLDOWN_MS = 5 * 60 * 1000;
const SUBMIT_COOLDOWN_KEY = 'dttr_last_submit';

function getSubmitCooldownRemaining() {
  try {
    const last = Number(localStorage.getItem(SUBMIT_COOLDOWN_KEY) || 0);
    return Math.max(0, SUBMIT_COOLDOWN_MS - (Date.now() - last));
  } catch (err) {
    return 0; // storage unavailable — don't block submission over it
  }
}

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

  // Phone field — strip anything that isn't a digit as they type, and cap
  // at 10. The pattern/maxlength on the input are a backstop; this is what
  // actually stops someone from typing a name into the phone field.
  const phoneInput = form.querySelector('#rf-phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const cooldownRemaining = getSubmitCooldownRemaining();
    if (cooldownRemaining > 0) {
      const minutes = Math.max(1, Math.ceil(cooldownRemaining / 60000));
      if (status) {
        status.textContent = `Looks like we just got your last request — give us a few minutes to catch up. You can send another in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
        status.hidden = false;
      }
      return;
    }

    // Netlify's notification email body is a fixed plain-text field list we
    // can't restyle, but the subject line IS whatever this hidden field's
    // value is — so build something scannable from an inbox list: who, what
    // device, what's wrong, without needing to open the email.
    const subjectField = form.querySelector('input[name="subject"]');
    if (subjectField) {
      const name = form.querySelector('#rf-name')?.value.trim();
      const device = form.querySelector('#rf-device')?.value.trim();
      const issue = form.querySelector('#rf-issue')?.value.trim();
      const parts = [name, device, issue].filter(Boolean);
      subjectField.value = parts.length
        ? `Repair request: ${parts.join(' — ')}`
        : 'New repair request';
    }

    // Sent as FormData (not URL-encoded) so the optional photo upload comes through —
    // the browser sets the multipart boundary header itself, so don't set Content-Type here.
    const data = new FormData(form);

    try {
      await fetch('/', {
        method: 'POST',
        body: data,
      });

      try {
        localStorage.setItem(SUBMIT_COOLDOWN_KEY, String(Date.now()));
      } catch (err) {
        // Private browsing or storage disabled — cooldown just won't persist.
      }

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

function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  const root = document.documentElement;

  const updateLabel = () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  };
  updateLabel();

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    updateLabel();
    try {
      localStorage.setItem('theme', next);
    } catch (err) {
      // Private browsing or storage disabled — theme just won't persist.
    }
  });
}

function initNavToggle() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  const closeMenu = () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  };

  const openMenu = () => {
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
  };

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.contains('is-open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Anchor links close the menu themselves once tapped.
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  // Escape, or a tap/click outside the open menu, closes it too.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    closeMenu();
  });

  // Resizing past the mobile breakpoint (e.g. rotating a tablet, or a
  // desktop window resize during testing) shouldn't leave a stale open
  // dropdown state hanging around once the inline nav takes over.
  const desktopQuery = window.matchMedia('(min-width: 1020px)');
  const handleBreakpointChange = (e) => {
    if (e.matches) closeMenu();
  };
  if (desktopQuery.addEventListener) {
    desktopQuery.addEventListener('change', handleBreakpointChange);
  } else {
    desktopQuery.addListener(handleBreakpointChange);
  }
}

// Loads the Google Maps JS SDK exactly once, however many times this gets
// called (the address field calls it on first focus; fetchSuggestions calls
// it again as a safety net in case input fires before focus for some reason).
let googleMapsLoadPromise;

function loadGoogleMapsScript(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

function initAddressAutocomplete() {
  const wrapper = document.querySelector('.address-autocomplete');
  const input = document.getElementById('rf-address');
  const list = document.getElementById('rf-address-list');
  if (!wrapper || !input || !list) return;

  // No key set up yet — leave the field as a plain text input. Nothing is
  // loaded or called over the network until a real key is in place.
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') return;

  // Biased toward Kelowna, BC so local streets rank first; still falls back
  // to anywhere in Canada.
  const KELOWNA_LON = -119.496;
  const KELOWNA_LAT = 49.888;

  let placesLib = null; // { AutocompleteSessionToken, AutocompleteSuggestion }
  let sessionToken = null;
  let debounceTimer;
  let requestId = 0;
  let activeIndex = -1;
  let results = [];

  const ensurePlacesLoaded = async () => {
    if (placesLib) return placesLib;
    await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);
    placesLib = await google.maps.importLibrary('places');
    return placesLib;
  };

  // A Places session (one search-and-select) is what Google bills as a
  // single unit — so a fresh token starts each search, and selecting a
  // result (which calls fetchFields) closes it out and we grab a new one
  // for next time, rather than reusing one token across unrelated searches.
  const refreshSessionToken = () => {
    if (placesLib) sessionToken = new placesLib.AutocompleteSessionToken();
  };

  // Don't load Google's script (or touch the API) until someone actually
  // focuses the field — most page visits will never need it.
  input.addEventListener(
    'focus',
    () => {
      ensurePlacesLoaded()
        .then(refreshSessionToken)
        .catch(() => {});
    },
    { once: true }
  );

  const closeList = () => {
    list.hidden = true;
    list.innerHTML = '';
    results = [];
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const renderResults = () => {
    list.innerHTML = '';
    results.forEach((suggestion, index) => {
      const item = document.createElement('li');
      item.className = 'address-suggestion';
      item.id = `rf-address-option-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === activeIndex));
      item.textContent = suggestion.placePrediction.text.toString();
      item.addEventListener('mousedown', (event) => {
        // mousedown (not click) so this fires before the input's blur event.
        event.preventDefault();
        selectResult(index);
      });
      list.appendChild(item);
    });

    // Google requires attribution when their place predictions are shown
    // outside of a Google-branded widget.
    if (results.length) {
      const attribution = document.createElement('li');
      attribution.className = 'address-attribution';
      attribution.setAttribute('role', 'presentation');
      attribution.textContent = 'Powered by Google';
      list.appendChild(attribution);
    }

    list.hidden = results.length === 0;
    input.setAttribute('aria-expanded', String(results.length > 0));
  };

  const selectResult = async (index) => {
    const suggestion = results[index];
    if (!suggestion) return;

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress'] });
      input.value = place.formattedAddress || suggestion.placePrediction.text.toString();
    } catch (err) {
      // Details fetch failed — the prediction text itself is still a
      // perfectly usable address, just fall back to that.
      input.value = suggestion.placePrediction.text.toString();
    }

    closeList();
    refreshSessionToken();
    input.focus();
  };

  const fetchSuggestions = async (query) => {
    const id = ++requestId;

    try {
      const lib = await ensurePlacesLoaded();
      if (!sessionToken) refreshSessionToken();

      const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken,
        includedRegionCodes: ['ca'],
        locationBias: { radius: 50000, center: { lat: KELOWNA_LAT, lng: KELOWNA_LON } },
      });

      if (id !== requestId) return; // a newer keystroke already superseded this
      results = suggestions || [];
      activeIndex = -1;
      renderResults();
    } catch (err) {
      if (id === requestId) closeList();
    }
  };

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(debounceTimer);
    if (query.length < 3) {
      closeList();
      return;
    }
    debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
  });

  input.addEventListener('keydown', (event) => {
    if (list.hidden || !results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % results.length;
      renderResults();
      input.setAttribute('aria-activedescendant', `rf-address-option-${activeIndex}`);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + results.length) % results.length;
      renderResults();
      input.setAttribute('aria-activedescendant', `rf-address-option-${activeIndex}`);
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0) {
        event.preventDefault();
        selectResult(activeIndex);
      }
    } else if (event.key === 'Escape') {
      closeList();
    }
  });

  input.addEventListener('blur', () => {
    // Let a mousedown-selection above run first, then close.
    setTimeout(closeList, 100);
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) closeList();
  });
}

function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  // No IntersectionObserver support — just show everything, no animation.
  if (!('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Once revealed, stay revealed — no re-hiding on scroll back up.
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => observer.observe(el));
}

initQuoteCards();
initRepairForm();
initThemeToggle();
initNavToggle();
initAddressAutocomplete();
initScrollReveal();