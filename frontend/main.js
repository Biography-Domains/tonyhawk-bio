/* shared.js — vanilla JS utilities for multi-page sites */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------
   * Mobile navigation toggle
   * Markup expectations (customizable):
   *  - Button: [data-nav-toggle]
   *  - Nav container: [data-nav]
   *  - Optional overlay: [data-nav-overlay]
   *  - Optional close triggers: [data-nav-close]
   * --------------------------- */
  function initMobileNav() {
    const toggle = $("[data-nav-toggle]");
    const nav = $("[data-nav]");
    if (!toggle || !nav) return;

    const overlay = $("[data-nav-overlay]");
    const closeEls = $$("[data-nav-close]");
    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    let lastActive = null;

    const isOpen = () => nav.classList.contains("is-open");

    const setExpanded = (expanded) => {
      toggle.setAttribute("aria-expanded", String(expanded));
      nav.setAttribute("aria-hidden", String(!expanded));
      if (overlay) overlay.classList.toggle("is-active", expanded);
      document.documentElement.classList.toggle("nav-open", expanded);
      document.body.classList.toggle("nav-open", expanded);
    };

    const openNav = () => {
      if (isOpen()) return;
      lastActive = document.activeElement;
      nav.classList.add("is-open");
      setExpanded(true);

      // Focus first focusable element in nav (or nav itself)
      const first = $(FOCUSABLE, nav);
      (first || nav).focus?.({ preventScroll: true });
    };

    const closeNav = () => {
      if (!isOpen()) return;
      nav.classList.remove("is-open");
      setExpanded(false);
      lastActive?.focus?.({ preventScroll: true });
    };

    const toggleNav = () => (isOpen() ? closeNav() : openNav());

    // ARIA defaults
    if (!toggle.hasAttribute("aria-controls")) {
      if (!nav.id) nav.id = "site-nav";
      toggle.setAttribute("aria-controls", nav.id);
    }
    toggle.setAttribute("aria-expanded", "false");
    nav.setAttribute("aria-hidden", "true");

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      toggleNav();
    });

    // Close on overlay click
    overlay?.addEventListener("click", closeNav);

    // Close on explicit close elements
    closeEls.forEach((el) => el.addEventListener("click", closeNav));

    // Close when clicking a nav link (common mobile behavior)
    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;
      // Only close for in-page anchors or same-site links
      closeNav();
    });

    // Escape to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });

    // Basic focus trap while open
    document.addEventListener("keydown", (e) => {
      if (!isOpen() || e.key !== "Tab") return;
      const focusables = $$(FOCUSABLE, nav).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Close on resize up (optional breakpoint)
    const mq = window.matchMedia("(min-width: 900px)");
    const onMQ = () => {
      if (mq.matches) closeNav();
    };
    mq.addEventListener?.("change", onMQ);
    onMQ();
  }

  /* ---------------------------
   * Smooth scroll for anchor links
   * - Applies to same-page hash links.
   * - Respects prefers-reduced-motion.
   * - Optional fixed header offset: [data-scroll-offset] element height.
   * --------------------------- */
  function initSmoothScroll() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const offsetEl = $("[data-scroll-offset]");
    const getOffset = () => (offsetEl ? offsetEl.getBoundingClientRect().height : 0);

    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href === "#") return;

      const id = decodeURIComponent(href.slice(1));
      const target = document.getElementById(id);
      if (!target) return;

      // Same-page only
      if (link.pathname && link.pathname !== location.pathname) return;

      e.preventDefault();

      const top =
        window.scrollY +
        target.getBoundingClientRect().top -
        getOffset();

      window.history.pushState(null, "", `#${encodeURIComponent(id)}`);

      window.scrollTo({
        top: Math.max(0, top),
        behavior: reduced ? "auto" : "smooth",
      });

      // Improve accessibility: move focus without jumping
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  }

  /* ---------------------------
   * Form validation helpers
   * - Adds .is-invalid / .is-valid classes.
   * - Uses native constraint validation + custom patterns:
   *   [data-validate="email|phone|url"] or data-pattern="..."
   * - Optional error container: [data-error-for="fieldNameOrId"]
   * --------------------------- */
  function initFormValidation() {
    const forms = $$("form");

    const patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^\+?[0-9\s().-]{7,}$/,
      url: /^(https?:\/\/)?([^\s.]+\.)+[^\s]{2,}([/?#].*)?$/i,
    };

    const setFieldState = (field, valid, message = "") => {
      field.classList.toggle("is-invalid", !valid);
      field.classList.toggle("is-valid", valid);

      const key = field.name || field.id;
      if (!key) return;

      const box =
        $(`[data-error-for="${CSS.escape(key)}"]`) ||
        field.closest("[data-field]")?.querySelector("[data-error]");

      if (box) {
        box.textContent = valid ? "" : message;
        box.hidden = valid;
      }

      // ARIA
      if (!valid) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    };

    const getMessage = (field) => {
      // Prefer custom message
      const custom = field.getAttribute("data-error-message");
      if (custom) return custom;

      // Native messages
      if (field.validity.valueMissing) return "This field is required.";
      if (field.validity.typeMismatch) return "Please enter a valid value.";
      if (field.validity.patternMismatch) return "Please match the requested format.";
      if (field.validity.tooShort) return `Please use at least ${field.minLength} characters.`;
      if (field.validity.tooLong) return `Please use no more than ${field.maxLength} characters.`;
      if (field.validity.rangeUnderflow) return `Value must be at least ${field.min}.`;
      if (field.validity.rangeOverflow) return `Value must be at most ${field.max}.`;
      if (field.validity.stepMismatch) return "Please enter a valid step value.";

      // Custom validation
      const rule = field.getAttribute("data-validate");
      const patternAttr = field.getAttribute("data-pattern");
      const val = (field.value || "").trim();

      if (val && rule && patterns[rule] && !patterns[rule].test(val)) {
        if (rule === "email") return "Please enter a valid email address.";
        if (rule === "phone") return "Please enter a valid phone number.";
        if (rule === "url") return "Please enter a valid URL.";
        return "Please enter a valid value.";
      }

      if (val && patternAttr) {
        try {
          const re = new RegExp(patternAttr);
          if (!re.test(val)) return "Please match the requested format.";
        } catch (_) {
          // ignore invalid regex
        }
      }

      return field.validationMessage || "Please check this field.";
    };

    const validateField = (field) => {
      if (field.disabled) return true;
      const type = (field.getAttribute("type") || "").toLowerCase();
      if (type === "submit" || type === "button" || type === "reset") return true;

      // Custom pattern checks (in addition to native)
      const rule = field.getAttribute("data-validate");
      const patternAttr = field.getAttribute("data-pattern");
      const val = (field.value || "").trim();

      let customOk = true;
      if (val && rule && patterns[rule]) customOk = patterns[rule].test(val);
      if (val && patternAttr) {
        try {
          customOk = customOk && new RegExp(patternAttr).test(val);
        } catch (_) {
          // invalid regex => ignore
        }
      }

      const nativeOk = field.checkValidity();
      const ok = nativeOk && customOk;
      setFieldState(field, ok, ok ? "" : getMessage(field));
      return ok;
    };

    const validateForm = (form) => {
      const fields = $$("input, select, textarea", form);
      let ok = true;
      fields.forEach((f) => {
        if (!validateField(f)) ok = false;
      });
      return ok;
    };

    forms.forEach((form) => {
      // Disable browser tooltips if desired
      if (form.hasAttribute("data-custom-validation")) form.setAttribute("novalidate", "novalidate");

      form.addEventListener("submit", (e) => {
        if (!validateForm(form)) {
          e.preventDefault();
          // Focus first invalid field
          const firstInvalid = $(".is-invalid", form);
          firstInvalid?.focus?.();
        }
      });

      // Live validation
      form.addEventListener("input", (e) => {
        const field = e.target.closest("input, select, textarea");
        if (!field) return;
        if (field.classList.contains("is-invalid")) validateField(field);
      });

      form.addEventListener("blur", (e) => {
        const field = e.target.closest("input, select, textarea");
        if (!field) return;
        validateField(field);
      }, true);
    });

    // Expose minimal API
    window.FormHelpers = {
      validateField: (el) => validateField(el),
      validateForm: (form) => validateForm(form),
    };
  }

  /* ---------------------------
   * Lazy loading for images
   * - Uses native loading="lazy" when available.
   * - For broader control: <img data-src="..." data-srcset="...">
   * - Optional: data-lazy-root-margin="200px 0px"
   * --------------------------- */
  function initLazyImages() {
    const imgs = $$("img[data-src], img[data-srcset], source[data-srcset]");
    if (!imgs.length) return;

    const apply = (el) => {
      if (el.tagName === "IMG") {
        if (el.dataset.srcset) el.srcset = el.dataset.srcset;
        if (el.dataset.src) el.src = el.dataset.src;
        el.removeAttribute("data-src");
        el.removeAttribute("data-srcset");
      } else if (el.tagName === "SOURCE") {
        if (el.dataset.srcset) el.srcset = el.dataset.srcset;
        el.removeAttribute("data-srcset");
      }
      el.classList.add("is-loaded");
    };

    // Prefer native lazy loading for <img> if no data-src used
    $$("img:not([loading])").forEach((img) => img.setAttribute("loading", "lazy"));

    if (!("IntersectionObserver" in window)) {
      imgs.forEach(apply);
      return;
    }

    const rootMargin = document.documentElement.getAttribute("data-lazy-root-margin") || "200px 0px";
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          apply(entry.target);
          io.unobserve(entry.target);
        });
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    imgs.forEach((el) => io.observe(el));
  }

  /* ---------------------------
   * Simple page transitions
   * - Adds classes to <html>:
   *   - "is-entering" on load (removed shortly after)
   *   - "is-leaving" on same-origin navigation clicks
   * - To enable, add CSS for these classes (fade/slide, etc).
   * - Respects prefers-reduced-motion.
   * - Optional: <html data-transition-duration="200">
   * --------------------------- */
  function initPageTransitions() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const html = document.documentElement;
    const duration = Number(html.getAttribute("data-transition-duration") || 180);

    // Enter
    html.classList.add("is-entering");
    window.setTimeout(() => html.classList.remove("is-entering"), 20);

    // Leave on link click (same-origin, not new tab, not downloads)
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;

      const href = a.getAttribute("href");
      if (!href) return;

      // Ignore hashes on same page
      if (href.startsWith("#")) return;

      // Ignore modified clicks / new tab / downloads
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;

      // Same-origin only
      let url;
      try {
        url = new URL(href, location.href);
      } catch (_) {
        return;
      }
      if (url.origin !== location.origin) return;

      // If it's just a hash change on same page, ignore
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

      e.preventDefault();

      html.classList.add("is-leaving");

      window.setTimeout(() => {
        location.href = url.href;
      }, duration);
    });

    // Handle bfcache restore
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) {
        html.classList.remove("is-leaving");
      }
    });
  }

  /* ---------------------------
   * Init
   * --------------------------- */
  function init() {
    initMobileNav();
    initSmoothScroll();
    initFormValidation();
    initLazyImages();
    initPageTransitions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();