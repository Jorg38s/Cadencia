/**
 * Interacciones generales: menú móvil, animaciones de entrada y semana tipo del inicio.
 * Sin dependencias. Todo el contenido es accesible también sin JavaScript.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- menú móvil ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var mq = window.matchMedia('(max-width: 899px)');
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    var onChange = function () { if (!mq.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    /* En móvil el menú cerrado no debe ser alcanzable con teclado: visibility lo gestiona el CSS. */
  }

  /* ---------- animación de entrada ---------- */
  var items = [].slice.call(document.querySelectorAll('.reveal'));
  if (items.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      items.forEach(function (el, i) {
        el.style.setProperty('--d', (i % 4) * 70 + 'ms');
        io.observe(el);
      });
    }
  }


  /* ---------- imágenes que no cargan: se conserva el marco, sin icono roto ---------- */
  var failed = function (img) {
    var fig = img.closest('.media');
    if (fig) fig.classList.add('media--empty');
    img.remove();
  };
  [].slice.call(document.querySelectorAll('.media img')).forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) failed(img);
    else img.addEventListener('error', function () { failed(img); }, { once: true });
  });

  /* ---------- semana tipo (inicio) ---------- */
  var week = document.querySelector('[data-week]');
  if (week) {
    var days = [].slice.call(week.querySelectorAll('.day'));
    var out = {
      day: week.querySelector('[data-week-day]'),
      name: week.querySelector('[data-week-name]'),
      text: week.querySelector('[data-week-text]')
    };
    var select = function (btn) {
      days.forEach(function (d) { d.setAttribute('aria-pressed', d === btn ? 'true' : 'false'); });
      out.day.textContent = btn.getAttribute('data-day');
      out.name.textContent = btn.getAttribute('data-title');
      out.text.textContent = btn.getAttribute('data-detail');
    };
    days.forEach(function (d) {
      d.addEventListener('click', function () { select(d); });
      d.addEventListener('mouseenter', function () { if (window.matchMedia('(hover: hover)').matches) select(d); });
      d.addEventListener('focus', function () { select(d); });
    });
    if (days.length) select(days[0]);
  }
})();
