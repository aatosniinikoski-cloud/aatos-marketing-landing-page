(() => {
  "use strict";

  const STORAGE_KEY = "aatos_cookie_consent_v1";
  const GA4_ID = "G-CETXR485ET";
  const isLeadPage = window.location.pathname.replace(/\/+$/, "") === "/kiitos.html";
  let analyticsLoaded = false;

  function readPreference() {
    try {
      const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (value && typeof value.analytics === "boolean") return value;
    } catch (error) {}
    return null;
  }

  function savePreference(preference) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        analytics: preference.analytics,
        marketing: false,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {}
  }

  function sendGoogleLead() {
    if (!isLeadPage || !window.gtag) return;
    try {
      if (window.sessionStorage.getItem("aatos_ga_lead_sent") === "1") return;
      window.gtag("event", "generate_lead", {
        currency: "EUR",
        value: 0,
        lead_source: "website_form"
      });
      window.sessionStorage.setItem("aatos_ga_lead_sent", "1");
    } catch (error) {
      window.gtag("event", "generate_lead", {
        currency: "EUR",
        value: 0,
        lead_source: "website_form"
      });
    }
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

  function applyPreference(preference, persist) {
    window.gtag("consent", "update", {
      analytics_storage: preference.analytics ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });

    if (preference.analytics) loadAnalytics();
    if (persist) savePreference(preference);
  }

  function buildInterface() {
    const banner = document.createElement("section");
    banner.id = "aatos-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "aatos-cookie-title");
    banner.innerHTML = [
      '<h2 class="aatos-cookie-title" id="aatos-cookie-title">Evästeasetukset</h2>',
      '<p class="aatos-cookie-copy">Sivusto käyttää välttämättömiä toimintoja. Luvallasi käytämme lisäksi Google Analyticsia sivuston kehittämiseen ja yhteydenottojen mittaamiseen.</p>',
      '<div class="aatos-cookie-actions">',
      '<button class="aatos-cookie-button aatos-cookie-button--primary" type="button" data-cookie-action="accept">Hyväksy analytiikka</button>',
      '<button class="aatos-cookie-button" type="button" data-cookie-action="reject">Vain välttämättömät</button>',
      '<button class="aatos-cookie-button" type="button" data-cookie-action="customize">Muokkaa asetuksia</button>',
      '</div>',
      '<div id="aatos-cookie-settings" hidden>',
      '<label class="aatos-cookie-choice"><input type="checkbox" checked disabled><span><strong>Välttämättömät</strong><span>Tarvitaan sivuston ja evästevalintojen toimintaan.</span></span></label>',
      '<label class="aatos-cookie-choice"><input id="aatos-consent-analytics" type="checkbox"><span><strong>Analytiikka</strong><span>Google Analytics auttaa ymmärtämään sivuston käyttöä ja onnistuneita yhteydenottoja.</span></span></label>',
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

    function openSettings() {
      const current = readPreference();
      analyticsInput.checked = current ? current.analytics : false;
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

      if (action === "accept") finish({ analytics: true });
      if (action === "reject") finish({ analytics: false });
      if (action === "customize") openSettings();
      if (action === "save") finish({ analytics: analyticsInput.checked });
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
