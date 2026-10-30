/* ==========================================================================
   A little apology — behaviour (vanilla JS, no dependencies)
   - "No" button dodges clicks/taps, always staying inside the card + viewport
     and never overlapping the "Yes" button
   - "Yes" opens an animated modal with a burst of hearts
   - Soft floating hearts in the background
   Optional personalisation via URL:  ?from=Alex   (adds a signature to the modal)
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var card = document.getElementById("card");
  var subtitle = document.getElementById("subtitle");
  var yesBtn = document.getElementById("yesBtn");
  var noBtn = document.getElementById("noBtn");
  var noSlot = document.getElementById("noSlot");
  var hint = document.getElementById("hint");
  var modal = document.getElementById("modal");
  var modalPanel = modal.querySelector(".modal__panel");
  var modalHearts = document.getElementById("modalHearts");
  var modalSign = document.getElementById("modalSign");
  var bgHearts = document.getElementById("bgHearts");

  var TINTS = ["#e0246b", "#e87aa6", "#c9a6e4", "#f3a6c2", "#b8134f"];
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  /* ---------- Personalisation ---------- */
  (function personalise() {
    var params = new URLSearchParams(window.location.search);
    var from = (params.get("from") || "").trim().slice(0, 40);
    if (from) {
      modalSign.textContent = "\u2014 " + from;
      modalSign.hidden = false;
    }
  })();

  /* ---------- Background floating hearts ---------- */
  function buildBackgroundHearts() {
    if (reduceMotion) return;
    var count = window.innerWidth < 600 ? 12 : 20;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var h = document.createElement("span");
      h.className = "float-heart";
      h.style.left = rand(0, 100) + "%";
      h.style.setProperty("--size", rand(12, 30).toFixed(0) + "px");
      h.style.setProperty("--dur", rand(14, 26).toFixed(1) + "s");
      h.style.setProperty("--delay", (-rand(0, 24)).toFixed(1) + "s");
      h.style.setProperty("--sway", rand(-50, 50).toFixed(0) + "px");
      h.style.setProperty("--alpha", rand(0.22, 0.5).toFixed(2));
      h.style.setProperty("--tint", pick(TINTS));
      frag.appendChild(h);
    }
    bgHearts.appendChild(frag);
  }
  buildBackgroundHearts();

  /* ======================================================================
     The playful "No" button
     ====================================================================== */
  var labels = ["No", "Sure?", "Really?", "Please?", "Hmm\u2026"];
  var hints = [
    "Nice try \uD83D\uDE04",
    "There is really only one right answer here.",
    "I'll wait. I'm very patient \uD83E\uDD7A",
    "That button seems a little shy today.",
    "Okay, okay\u2026 the pink one is looking good, right?"
  ];
  var attempts = 0;
  var lastDodge = 0;
  var offset = { x: 0, y: 0 }; // translate relative to the slot

  function overlaps(a, b, pad) {
    return !(a.right + pad < b.left || a.left - pad > b.right ||
             a.bottom + pad < b.top || a.top - pad > b.bottom);
  }

  function dodge() {
    var now = Date.now();
    if (now - lastDodge < 220) return; // avoid jitter from stacked events
    lastDodge = now;

    var cardRect = card.getBoundingClientRect();
    var slotRect = noSlot.getBoundingClientRect();
    var yesRect = yesBtn.getBoundingClientRect();
    var curRect = noBtn.getBoundingClientRect();
    var subRect = subtitle.getBoundingClientRect();

    var w = noBtn.offsetWidth;
    var h = noBtn.offsetHeight;
    var margin = 14;
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;

    // Safe region = card ∩ viewport, below the subtitle so text stays readable.
    var left = Math.max(cardRect.left, 0) + margin;
    var right = Math.min(cardRect.right, vw) - margin;
    var top = Math.max(subRect.bottom + 10, 0) + 0;
    var bottom = Math.min(cardRect.bottom, vh) - margin;
    top = Math.max(top, margin);

    // If the visible part of the card is too short, relax to the whole card.
    if (bottom - top < h + 8) {
      top = Math.max(cardRect.top, 0) + margin;
    }

    var maxX = Math.max(left, right - w);
    var maxY = Math.max(top, bottom - h);

    var best = null;
    var bestScore = -Infinity;

    for (var i = 0; i < 70; i++) {
      var x = rand(left, maxX);
      var y = rand(top, maxY);
      var rect = { left: x, top: y, right: x + w, bottom: y + h };

      var hitsYes = overlaps(rect, yesRect, 14);
      var dist = Math.hypot(x - curRect.left, y - curRect.top);
      var yesDist = Math.hypot(x - yesRect.left, y - yesRect.top);

      // Prefer valid spots that are well away from where we are now.
      var score = (hitsYes ? -1e6 : 0) + Math.min(dist, 220) + yesDist * 0.05;
      if (score > bestScore) { bestScore = score; best = { x: x, y: y }; }
      if (!hitsYes && dist > 90) { best = { x: x, y: y }; bestScore = Infinity; break; }
    }

    offset.x = Math.round(best.x - slotRect.left);
    offset.y = Math.round(best.y - slotRect.top);
    noBtn.style.transform = "translate3d(" + offset.x + "px," + offset.y + "px,0)";

    attempts += 1;
    noBtn.textContent = labels[attempts % labels.length];
    hint.textContent = hints[(attempts - 1) % hints.length];
    hint.classList.add("is-visible");
  }

  // Mouse: dodge as soon as the cursor gets close.
  noBtn.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "mouse") dodge();
  });
  // Touch / pen / mouse press: dodge before a click can complete.
  noBtn.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    dodge();
  });
  noBtn.addEventListener("touchstart", function (e) {
    e.preventDefault();
    dodge();
  }, { passive: false });
  // Keyboard (Enter / Space) and any stray click.
  noBtn.addEventListener("click", function (e) {
    e.preventDefault();
    lastDodge = 0;
    dodge();
  });

  // Keep the button safe when the layout changes.
  var resizeTimer;
  function resetNo() {
    noBtn.style.transform = "";
    offset.x = 0; offset.y = 0;
  }
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resetNo, 150);
  });
  window.addEventListener("orientationchange", resetNo);

  /* ======================================================================
     Modal
     ====================================================================== */
  var lastFocus = null;
  var closeTimer;

  function burstHearts() {
    if (reduceMotion) return;
    modalHearts.textContent = "";
    var frag = document.createDocumentFragment();
    var i, el, angle, dist;

    for (i = 0; i < 30; i++) {
      el = document.createElement("span");
      el.className = "burst-heart";
      angle = rand(0, Math.PI * 2);
      dist = rand(90, 260);
      el.style.setProperty("--dx", Math.round(Math.cos(angle) * dist) + "px");
      el.style.setProperty("--dy", Math.round(Math.sin(angle) * dist - 40) + "px");
      el.style.setProperty("--size", rand(10, 26).toFixed(0) + "px");
      el.style.setProperty("--rot", rand(-40, 40).toFixed(0) + "deg");
      el.style.setProperty("--dur", rand(1.3, 2.2).toFixed(2) + "s");
      el.style.setProperty("--delay", rand(0, 0.35).toFixed(2) + "s");
      el.style.setProperty("--tint", pick(TINTS));
      frag.appendChild(el);
    }
    for (i = 0; i < 9; i++) {
      el = document.createElement("span");
      el.className = "rise-heart";
      el.style.left = rand(6, 94) + "%";
      el.style.setProperty("--size", rand(9, 18).toFixed(0) + "px");
      el.style.setProperty("--dur", rand(4, 7).toFixed(1) + "s");
      el.style.setProperty("--delay", rand(0.4, 4).toFixed(1) + "s");
      el.style.setProperty("--sway", rand(-30, 30).toFixed(0) + "px");
      el.style.setProperty("--tint", pick(TINTS));
      frag.appendChild(el);
    }
    modalHearts.appendChild(frag);
  }

  function openModal() {
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    modal.hidden = false;
    void modal.offsetWidth; // force reflow so the transition runs
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    burstHearts();
    modalPanel.focus({ preventScroll: true });
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    closeTimer = setTimeout(function () {
      modal.hidden = true;
      modalHearts.textContent = "";
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 420);
  }

  yesBtn.addEventListener("click", openModal);

  modal.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key === "Tab") {
      // Simple focus trap inside the dialog.
      var focusables = modalPanel.querySelectorAll("button");
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modalPanel)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });
})();
