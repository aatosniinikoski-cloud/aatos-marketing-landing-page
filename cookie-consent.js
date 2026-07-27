(() => {
  "use strict";

  const STORAGE_KEY = "aatos_cookie_consent_v2";
  const GA4_ID = "G-CETXR485ET";
  const META_PIXEL_ID = "26945439295122237";
  const FORM_SUBMISSION_KEY = "aatos_successful_form_submission_v1";
  const FORM_SUBMISSION_MAX_AGE_MS = 30 * 60 * 1000;
  const isLeadPage = window.location.pathname.replace(/\/+$/, "") === "/kiitos.html";

  let analyticsLoaded = false;
  let metaLoaded = false;
  let metaPageViewSent = false;
  let fetchWrapped = false;

  function readPreference() {
    try {
      const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (
        value &&
        typeof value.analytics === "boolean" &&
        typeof value.marketing === "boolean"
      ) {
        return value;
      }
    } catch (error) {}
    return null;
  }

  function savePreference(preference) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        analytics: preference.analytics === true,
        marketing: preference.marketing === true,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {}
  }

  function readSubmission() {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(FORM_SUBMISSION_KEY));
      if (!value || typeof value.createdAt !== "number") return null;

      const age = Date.now() - value.createdAt;
      if (age < 0 || age > FORM_SUBMISSION_MAX_AGE_MS) {
        window.sessionStorage.removeItem(FORM_SUBMISSION_KEY);
        return null;
      }

      return {
        createdAt: value.createdAt,
        gaSent: value.gaSent === true,
        metaSent: value.metaSent === true
      };
    } catch (error) {
      return null;
    }
  }

  function writeSubmission(submission) {
    try {
      window.sessionStorage.setItem(FORM_SUBMISSION_KEY, JSON.stringify(submission));
    } catch (error) {}
  }

  function markSuccessfulSubmission() {
    writeSubmission({
      createdAt: Date.now(),
      gaSent: false,
      metaSent: false
    });
  }

  function markSubmissionEventSent(eventType) {
    const submission = readSubmission();
    if (!submission) return;

    if (eventType === "ga") submission.gaSent = true;
    if (eventType === "meta") submission.metaSent = true;
    writeSubmission(submission);
  }

  function installSubmissionTracking() {
    if (fetchWrapped || typeof window.fetch !== "function") return;

    const contactForm = document.getElementById("contact-form");
    if (!contactForm || !contactForm.action) return;

    const formAction = new URL(contactForm.action, window.location.href).href;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function (input, init) {
      const response = await originalFetch(input, init);

      try {
        const requestUrl = typeof input === "string"
          ? new URL(input, window.location.href).href
          : input && input.url
            ? new URL(input.url, window.location.href).href
            : "";
        const method = String(
          (init && init.method) || (input && input.method) || "GET"
        ).toUpperCase();

        if (method === "POST" && requestUrl === formAction && response.ok) {
          let successful = response.status === 200;

          try {
            const result = await response.clone().json();
            successful = result.success === true || response.status === 200;
          } catch (error) {}

          if (successful) markSuccessfulSubmission();
        }
      } catch (error) {}

      return response;
    };

    fetchWrapped = true;
  }

  function sendGoogleLead() {
    if (!isLeadPage || !window.gtag) return;

    const submission = readSubmission();
    if (!submission || submission.gaSent) return;

    window.gtag("event", "generate_lead", {
      currency: "EUR",
      value: 0,
      lead_source: "website_form"
    });
    markSubmissionEventSent("ga");
  }

  function loadAnalytics() {
    if (analyticsLoaded) {
      sendGoogleLead();
      return;
    }

    analyticsLoaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
    document.head.appendChild(script);

    window.gtag("js", new Date());
    window.gtag("config", GA4_ID, { anonymize_ip: true });
    sendGoogleLead();
  }

  function ensureMetaQueue() {
    if (window.fbq) return window.fbq;

    const fbq = function () {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, arguments);
      } else {
        fbq.queue.push(arguments);
      }
    };

    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    return fbq;
  }

  function sendMetaLead() {
    if (!isLeadPage || !window.fbq) return;

    const submission = readSubmission();
    if (!submission || submission.metaSent) return;

    window.fbq("track", "Lead");
    markSubmissionEventSent("meta");
  }

  function loadMetaPixel() {
    const fbq = ensureMetaQueue();

    if (!metaLoaded) {
      metaLoaded = true;
      fbq("consent", "grant");
      fbq("init", META_PIXEL_ID);

      const existingScript = document.querySelector(
        'script[src="https://connect.facebook.net/en_US/fbevents.js"]'
      );

      if (!existingScript) {
        const script = document.createElement("script");
        script.async = true;
        script.src = "https://connect.facebook.net/en_US/fbevents.js";
        script.dataset.aatosMetaPixel = META_PIXEL_ID;
        document.head.appendChild(script);
      }
    } else {
      fbq("consent", "grant");
    }

    if (!metaPageViewSent) {
      fbq("track", "PageView");
      metaPageViewSent = true;
    }

    sendMetaLead();
  }

  function applyPreference(preference, persist) {
    const normalized = {
      analytics: preference.analytics === true,
      marketing: preference.marketing === true
    };

    window.gtag("consent", "update", {
      analytics_storage: normalized.analytics ? "granted" : "denied",
      ad_storage: normalized.marketing ? "granted" : "denied",
      ad_user_data: normalized.marketing ? "granted" : "denied",
      ad_personalization: normalized.marketing ? "granted" : "denied"
    });

    if (normalized.analytics) loadAnalytics();

    if (normalized.marketing) {
      loadMetaPixel();
    } else if (window.fbq) {
      window.fbq("consent", "revoke");
    }

    if (persist) savePreference(normalized);
  }

  function buildInterface() {
    installSubmissionTracking();

    const banner = document.createElement("section");
    banner.id = "aatos-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "aatos-cookie-title");
    banner.innerHTML = [
      '<h2 class="aatos-cookie-title" id="aatos-cookie-title">Evästeasetukset</h2>',
      '<p class="aatos-cookie-copy">Sivustomme käyttää välttämättömiä evästeitä sivuston toimintaan. Suostumuksellasi käytämme lisäksi analytiikkaevästeitä sivuston kehittämiseen sekä markkinointievästeitä mainonnan mittaamiseen.</p>',
      '<div class="aatos-cookie-actions">',
      '<button class="aatos-cookie-button aatos-cookie-button--primary" type="button" data-cookie-action="accept">Hyväksy kaikki</button>',
      '<button class="aatos-cookie-button" type="button" data-cookie-action="reject">Vain välttämättömät</button>',
      '<button class="aatos-cookie-button" type="button" data-cookie-action="customize">Muokkaa asetuksia</button>',
      '</div>',
      '<div id="aatos-cookie-settings" hidden>',
      '<label class="aatos-cookie-choice"><input type="checkbox" checked disabled><span><strong>Välttämättömät</strong><span>Tarvitaan sivuston ja evästevalintojen toimintaan.</span></span></label>',
      '<label class="aatos-cookie-choice"><input id="aatos-consent-analytics" type="checkbox"><span><strong>Analytiikka</strong><span>Google Analytics auttaa ymmärtämään sivuston käyttöä ja onnistuneita yhteydenottoja.</span></span></label>',
      '<label class="aatos-cookie-choice"><input id="aatos-consent-marketing" type="checkbox"><span><strong>Markkinointi</strong><span>Meta Pixel auttaa mittaamaan Facebook- ja Instagram-mainonnan tuloksia.</span></span></label>',
      '<div class="aatos-cookie-actions"><button class="aatos-cookie-button aatos-cookie-button--primary" type="button" data-cookie-action="save">Tallenna valinta</button></div>',
      '</div>'
    ].join("");

    const preferencesButton = document.createElement("button");
    preferencesButton.id = "aatos-cookie-preferences";
    preferencesButton.type = "button";
    preferencesButton.textContent = "Evästeasetukset";

    document.body.appendChild(banner);
    document.body.appendChild(preferencesButton);

    const settings = banner.querySelector("#aatos-cookie-settings");
    const analyticsInput = banner.querySelector("#aatos-consent-analytics");
    const marketingInput = banner.querySelector("#aatos-consent-marketing");

    function openSettings() {
      const current = readPreference();
      analyticsInput.checked = current ? current.analytics : false;
      marketingInput.checked = current ? current.marketing : false;
      settings.hidden = false;
      banner.hidden = false;
      preferencesButton.hidden = true;
    }

    function finish(preference) {
      applyPreference(preference, true);
      banner.hidden = true;
      preferencesButton.hidden = false;
    }

    banner.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cookie-action]");
      if (!button) return;
      const action = button.getAttribute("data-cookie-action");

      if (action === "accept") finish({ analytics: true, marketing: true });
      if (action === "reject") finish({ analytics: false, marketing: false });
      if (action === "customize") openSettings();
      if (action === "save") {
        finish({
          analytics: analyticsInput.checked,
          marketing: marketingInput.checked
        });
      }
    });

    preferencesButton.addEventListener("click", openSettings);

    const stored = readPreference();
    if (stored) {
      applyPreference(stored, false);
      banner.hidden = true;
      preferencesButton.hidden = false;
    } else {
      banner.hidden = false;
      preferencesButton.hidden = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildInterface, { once: true });
  } else {
    buildInterface();
  }
})();
