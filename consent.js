/**
 * Gestor de consentimiento de cookies/tecnologías opcionales.
 *
 * Principios:
 *  - Nada opcional se carga antes de que la persona lo acepte.
 *  - Aceptar y rechazar tienen el mismo peso visual; "Configurar" permite elegir por categoría.
 *  - Las casillas de cada categoría parten desmarcadas.
 *  - Retirar el consentimiento es tan fácil como darlo (enlace "Preferencias de cookies" en el pie).
 *  - Si el sitio no declara categorías opcionales (config.js), no se muestra banner y no se guarda nada.
 *
 * API pública: window.CadenciaConsent = { open(), openDemo(), getState() }
 */
(function () {
  'use strict';

  var CFG = (window.CADENCIA_CONFIG && window.CADENCIA_CONFIG.consent) || { categories: [], storageKey: 'cadencia.consent.v1', maxAgeDays: 180 };
  var KEY = CFG.storageKey;
  var CATS = Array.isArray(CFG.categories) ? CFG.categories : [];
  var VERSION = (document.querySelector('meta[name="policy-version"]') || {}).content || '1';

  var DEMO_CATS = [
    { id: 'analytics', label: 'Analítica (ejemplo)', description: 'Ejemplo ilustrativo: medir qué páginas se visitan para mejorar el sitio. No existe en este sitio.' },
    { id: 'marketing', label: 'Publicidad y redes (ejemplo)', description: 'Ejemplo ilustrativo: medir campañas y mostrar anuncios relevantes. No existe en este sitio.' }
  ];

  var banner, dialog, list, emptyNote, demoNote, actions, statusEl;
  var demoMode = false;
  var lastFocus = null;
  var loaded = {};

  /* ---------- almacenamiento seguro ---------- */
  function readState() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      var age = (Date.now() - new Date(s.ts).getTime()) / 86400000;
      if (!s || s.v !== VERSION || age > CFG.maxAgeDays || typeof s.choices !== 'object') return null;
      return s;
    } catch (e) { return null; }
  }
  function writeState(choices) {
    var s = { v: VERSION, ts: new Date().toISOString(), choices: choices };
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* sin almacenamiento: se pregunta en cada visita */ }
    return s;
  }

  /* ---------- carga condicionada de scripts ---------- */
  function loadCategory(cat) {
    if (loaded[cat.id] || !cat.scripts) return;
    loaded[cat.id] = true;
    cat.scripts.forEach(function (def) {
      var el = document.createElement('script');
      el.src = def.src;
      Object.keys(def.attrs || {}).forEach(function (k) { el.setAttribute(k, def.attrs[k]); });
      document.head.appendChild(el);
    });
  }
  function applyChoices(choices) {
    CATS.forEach(function (c) { if (choices[c.id]) loadCategory(c); });
  }

  /* ---------- interfaz ---------- */
  function cache() {
    banner = document.getElementById('cc-banner');
    dialog = document.getElementById('cc-dialog');
    list = document.getElementById('cc-list');
    emptyNote = document.getElementById('cc-empty');
    demoNote = document.getElementById('cc-demo-note');
    actions = document.getElementById('cc-actions');
    statusEl = document.getElementById('cc-status');
  }

  function renderList(cats, current) {
    list.innerHTML = '';
    var base = document.createElement('div');
    base.className = 'cc-item';
    base.innerHTML = '<div><h3>Esenciales</h3><p>Necesarias para que el sitio funcione y para recordar tu elección sobre cookies. Siempre activas.</p></div>' +
      '<label class="cc-switch"><span class="sr-only">Cookies esenciales: siempre activas</span><input type="checkbox" checked disabled><span aria-hidden="true"></span></label>';
    list.appendChild(base);
    cats.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'cc-item';
      var id = 'cc-cat-' + c.id;
      row.innerHTML = '<div><h3></h3><p></p></div><label class="cc-switch" for="' + id + '"><span class="sr-only"></span><input type="checkbox" id="' + id + '" data-cat="' + c.id + '"><span aria-hidden="true"></span></label>';
      row.querySelector('h3').textContent = c.label;
      row.querySelector('p').textContent = c.description;
      row.querySelector('.sr-only').textContent = 'Permitir: ' + c.label;
      var input = row.querySelector('input');
      input.checked = !!(current && current[c.id]);      // por defecto desmarcada
      list.appendChild(row);
    });
  }

  function getDialogChoices(cats) {
    var out = {};
    cats.forEach(function (c) {
      var el = document.getElementById('cc-cat-' + c.id);
      out[c.id] = !!(el && el.checked);
    });
    return out;
  }

  function showBanner(show) { if (banner) banner.hidden = !show; }

  function openDialog(cats, isDemo) {
    cache();
    if (!dialog) return;
    demoMode = !!isDemo;
    lastFocus = document.activeElement;
    var state = readState();
    emptyNote.hidden = cats.length > 0;
    demoNote.hidden = !demoMode;
    actions.hidden = cats.length === 0;
    statusEl.textContent = '';
    renderList(cats, demoMode ? null : state && state.choices);
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
    var first = dialog.querySelector('input:not([disabled])') || dialog.querySelector('[data-cc="close"]');
    if (first) first.focus();
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function commit(choices, cats) {
    if (demoMode) {
      statusEl.textContent = 'Modo demostración: no se guardó ni se activó nada.';
      showBanner(false);
      return;
    }
    var before = readState();
    var hadOptional = before && cats.some(function (c) { return before.choices[c.id]; });
    writeState(choices);
    showBanner(false);
    var withdrew = hadOptional && cats.some(function (c) { return before.choices[c.id] && !choices[c.id]; });
    applyChoices(choices);
    if (withdrew) {
      statusEl.textContent = 'Preferencias guardadas. Recargamos la página para desactivar lo que retiraste…';
      setTimeout(function () { window.location.reload(); }, 900);
    } else {
      statusEl.textContent = 'Preferencias guardadas.';
      setTimeout(closeDialog, 700);
    }
  }

  function setAll(value, cats) {
    var choices = {};
    cats.forEach(function (c) { choices[c.id] = value; });
    commit(choices, cats);
  }

  function currentCats() { return demoMode ? DEMO_CATS : CATS; }

  function onClick(e) {
    var btn = e.target.closest('[data-cc]');
    if (!btn) return;
    var action = btn.getAttribute('data-cc');
    var cats = currentCats();
    if (action === 'accept' || action === 'accept-dialog') setAll(true, cats);
    else if (action === 'reject' || action === 'reject-dialog') setAll(false, cats);
    else if (action === 'configure') { showBanner(false); openDialog(cats, demoMode); }
    else if (action === 'save') commit(getDialogChoices(cats), cats);
    else if (action === 'close') closeDialog();
  }

  function init() {
    cache();
    if (!banner || !dialog) return;
    document.addEventListener('click', onClick);
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-cookie-settings]');
      if (t) { e.preventDefault(); api.open(); }
      var d = e.target.closest('[data-cookie-demo]');
      if (d) { e.preventDefault(); api.openDemo(); }
    });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDialog(); });
    dialog.addEventListener('close', function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });

    if (CATS.length === 0) { showBanner(false); updateStatusBlocks(); return; }
    var state = readState();
    if (state) { applyChoices(state.choices); showBanner(false); }
    else showBanner(true);
    updateStatusBlocks();
  }

  /* bloque informativo de cookies.html: muestra el estado real */
  function updateStatusBlocks() {
    var el = document.getElementById('cookie-state-text');
    if (!el) return;
    if (CATS.length === 0) { el.textContent = 'Estado actual: este sitio no utiliza cookies ni almacenamiento opcional, así que no hay nada que aceptar o rechazar.'; return; }
    var s = readState();
    el.textContent = s ? 'Estado actual: ya registraste tus preferencias. Puedes cambiarlas cuando quieras.' : 'Estado actual: aún no has elegido. Las cookies opcionales permanecen desactivadas.';
  }

  var api = {
    open: function () { demoMode = false; showBanner(false); openDialog(CATS, false); },
    openDemo: function () { demoMode = true; showBanner(false); openDialog(DEMO_CATS, true); },
    getState: function () { return readState(); }
  };
  window.CadenciaConsent = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
