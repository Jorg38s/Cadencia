/**
 * Formularios de Cadencia: validación accesible, consentimientos separados y envío configurable.
 *
 * - Cada formulario es <form data-form="solicitud|contacto" novalidate>.
 * - Los campos obligatorios usan [data-required]; los mensajes de error están en .field__error.
 * - El envío real depende de CADENCIA_CONFIG.forms.endpoint. Sin endpoint = modo demostración
 *   (se valida, pero NO se envía ni se guarda nada, y se le dice claramente a la persona).
 * - Los consentimientos se incluyen en el JSON con fecha, versión de la política y el texto mostrado,
 *   para que el backend los registre. El navegador no guarda nada de lo que se escribe.
 */
(function () {
  'use strict';

  var CFG = (window.CADENCIA_CONFIG && window.CADENCIA_CONFIG.forms) || { endpoint: '' };
  var POLICY_VERSION = (document.querySelector('meta[name="policy-version"]') || {}).content || '';

  var MESSAGES = {
    required: 'Este campo es obligatorio.',
    email: 'Escribe un correo válido, por ejemplo nombre@dominio.cl.',
    phone: 'Escribe un teléfono válido (solo números, espacios, + o guiones).',
    minlength: function (n) { return 'Escribe al menos ' + n + ' caracteres.'; },
    consent: 'Debes marcar esta casilla para poder enviar el formulario.',
    choice: 'Elige una opción.',
    health: 'Escribe la información que quieres compartir o desmarca el consentimiento.'
  };

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^[+()\-\s\d]{8,18}$/;

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }

  function fieldWrap(el) { return el.closest('.field') || el.closest('.check-group') || el.parentElement; }
  function errorEl(el) {
    var w = fieldWrap(el);
    return w ? w.querySelector('.field__error') : null;
  }

  function setError(el, msg) {
    var err = errorEl(el);
    var wrap = fieldWrap(el);
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      if (wrap) wrap.classList.add('has-error');
      if (err) { err.textContent = msg; if (!el.getAttribute('aria-describedby') || el.getAttribute('aria-describedby').indexOf(err.id) === -1) { el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '') + ' ' + err.id).trim()); } }
    } else {
      el.removeAttribute('aria-invalid');
      if (wrap) wrap.classList.remove('has-error');
      if (err) err.textContent = '';
    }
  }

  function validateField(el) {
    if (el.disabled) { setError(el, ''); return ''; }
    var type = el.type;
    var value = (el.value || '').trim();
    var msg = '';

    if (type === 'checkbox') {
      if (el.hasAttribute('data-required') && !el.checked) msg = MESSAGES.consent;
    } else if (type === 'radio') {
      var group = qsa('input[type="radio"][name="' + el.name + '"]', el.form);
      if (el.hasAttribute('data-required') && !group.some(function (r) { return r.checked; })) msg = MESSAGES.choice;
      el = group[0];
    } else if (el.hasAttribute('data-required') && !value) {
      msg = el.tagName === 'SELECT' ? MESSAGES.choice : MESSAGES.required;
    } else if (value) {
      if (type === 'email' && !EMAIL_RE.test(value)) msg = MESSAGES.email;
      else if (type === 'tel' && !PHONE_RE.test(value)) msg = MESSAGES.phone;
      else if (el.dataset.minlength && value.length < Number(el.dataset.minlength)) msg = MESSAGES.minlength(el.dataset.minlength);
    }
    setError(el, msg);
    return msg;
  }

  function initForm(form) {
    var kind = form.getAttribute('data-form');
    var status = qs('.form-status', form);
    var submit = qs('[type="submit"]', form);

    /* bloque de salud: la caja de texto solo se habilita con consentimiento explícito */
    var healthConsent = qs('[name="consentSalud"]', form);
    var healthText = qs('[name="infoSalud"]', form);
    if (healthConsent && healthText) {
      var syncHealth = function () {
        healthText.disabled = !healthConsent.checked;
        if (!healthConsent.checked) { healthText.value = ''; setError(healthText, ''); }
        healthText.setAttribute('aria-disabled', String(!healthConsent.checked));
      };
      healthConsent.addEventListener('change', syncHealth);
      syncHealth();
    }

    /* plan preseleccionado desde ?plan=inicio|cadencia|hibrido */
    var planSel = qs('[name="plan"]', form);
    if (planSel) {
      try {
        var p = new URLSearchParams(window.location.search).get('plan');
        if (p && qsa('option', planSel).some(function (o) { return o.value === p; })) planSel.value = p;
      } catch (e) { /* sin soporte: se deja el valor por defecto */ }
    }

    /* motivo preseleccionado desde ?motivo=... */
    var motivo = qs('[name="motivo"]', form);
    if (motivo) {
      try {
        var m = new URLSearchParams(window.location.search).get('motivo');
        if (m && qsa('option', motivo).some(function (o) { return o.value === m; })) motivo.value = m;
      } catch (e) { /* idem */ }
    }

    qsa('input, select, textarea', form).forEach(function (el) {
      var ev = (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') ? 'change' : 'blur';
      el.addEventListener(ev, function () { validateField(el); });
      if (ev === 'blur') el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') validateField(el); });
    });

    function showStatus(type, html) {
      status.className = 'form-status form-status--' + type + ' is-visible';
      status.innerHTML = html;
      status.setAttribute('tabindex', '-1');
      status.focus({ preventScroll: false });
    }

    function collect() {
      var fd = new FormData(form);
      var data = {};
      fd.forEach(function (v, k) {
        if (k === 'website' || k.indexOf('consent') === 0) return; // honeypot y casillas se tratan aparte
        data[k] = typeof v === 'string' ? v.trim() : v;
      });
      var now = new Date().toISOString();
      var consents = {};
      qsa('input[type="checkbox"][name^="consent"]', form).forEach(function (c) {
        var label = qs('.check__text', c.closest('.check'));
        consents[c.name] = {
          accepted: c.checked,
          text: label ? label.textContent.replace(/\s+/g, ' ').trim() : '',
          timestamp: now,
          policyVersion: POLICY_VERSION
        };
      });
      return { form: kind, submittedAt: now, page: window.location.pathname.split('/').pop(), data: data, consents: consents };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';

      var fields = qsa('input, select, textarea', form).filter(function (el) { return el.type !== 'submit' && el.type !== 'hidden' && !el.closest('.hp'); });
      var seen = {};
      var errors = [];
      fields.forEach(function (el) {
        if (el.type === 'radio') { if (seen[el.name]) return; seen[el.name] = true; }
        var msg = validateField(el);
        if (msg) errors.push({ el: el.type === 'radio' ? qsa('input[type="radio"][name="' + el.name + '"]', form)[0] : el, msg: msg });
      });

      /* si marcó el consentimiento de salud, el texto no puede estar vacío */
      if (healthConsent && healthConsent.checked && healthText && !healthText.value.trim()) {
        setError(healthText, MESSAGES.health);
        errors.push({ el: healthText, msg: MESSAGES.health });
      }

      if (errors.length) {
        var items = errors.map(function (er) {
          var lab = fieldWrap(er.el) && qs('.field__label, legend', fieldWrap(er.el));
          var name = lab ? lab.firstChild.textContent.replace('*', '').trim() : er.el.name;
          if (er.el.type === 'checkbox') name = 'Casilla obligatoria';
          return '<li><a href="#' + er.el.id + '">' + name + '</a>: ' + er.msg + '</li>';
        }).join('');
        showStatus('error', '<strong>Revisa ' + (errors.length === 1 ? 'un campo' : errors.length + ' campos') + ' antes de enviar</strong><ul>' + items + '</ul>');
        errors[0].el.focus();
        return;
      }

      /* trampa antispam: si se rellena, se descarta en silencio */
      if (qs('[name="website"]', form) && qs('[name="website"]', form).value) { showStatus('ok', '<strong>Listo.</strong> Hemos recibido tu mensaje.'); form.reset(); return; }

      var payload = collect();
      submit.disabled = true;
      var original = submit.textContent;
      submit.textContent = 'Enviando…';

      var done = function () { submit.disabled = false; submit.textContent = original; };

      if (!CFG.endpoint) {
        /* MODO DEMOSTRACIÓN: no se envía nada. */
        window.setTimeout(function () {
          done();
          if (window.console && console.info) console.info('[Cadencia · modo demostración] Esto es lo que se enviaría al backend:', payload);
          showStatus('demo', '<strong>Formulario validado correctamente (modo demostración).</strong> Este sitio aún no tiene un servicio de envío conectado, así que <u>no se envió ni se guardó nada</u>. Cuando se configure el servicio, ' +
            (kind === 'solicitud' ? 'te responderemos en un máximo de ' + (document.body.getAttribute('data-answer-days') || '2') + ' días hábiles.' : 'responderemos tu consulta por el medio que indicaste.'));
          form.reset();
          if (healthConsent) healthConsent.dispatchEvent(new Event('change'));
        }, 500);
        return;
      }

      fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res; })
        .then(function () {
          done();
          showStatus('ok', '<strong>Gracias, recibimos tu ' + (kind === 'solicitud' ? 'solicitud' : 'consulta') + '.</strong> ' +
            (kind === 'solicitud' ? 'Te responderemos por correo en un máximo de ' + (document.body.getAttribute('data-answer-days') || '2') + ' días hábiles.' : 'Te responderemos por correo.'));
          form.reset();
          if (healthConsent) healthConsent.dispatchEvent(new Event('change'));
        })
        .catch(function () {
          done();
          showStatus('error', '<strong>No pudimos enviar el formulario.</strong> Revisa tu conexión e inténtalo de nuevo. Tus datos siguen en el formulario. Si el problema continúa, escríbenos a <a href="mailto:' + (form.getAttribute('data-fallback-email') || '') + '">' + (form.getAttribute('data-fallback-email') || 'nuestro correo') + '</a>.');
        });
    });
  }

  qsa('form[data-form]').forEach(initForm);
})();
