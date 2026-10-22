/**
 * Configuración de Cadencia (única fuente para integraciones).
 * Se carga antes que el resto de los scripts.
 */
window.CADENCIA_CONFIG = {
  /* ------------------------------------------------------------------
   * FORMULARIOS
   * endpoint: URL que recibirá el JSON de cada formulario (POST).
   *   - Vacío ("")  → modo demostración: se valida y se muestra el resultado,
   *     pero NO se envía ni se guarda nada.
   *   - Con URL     → se envía el formulario con fetch(). Debe ser un backend propio
   *     o un servicio de formularios (p. ej. Formspree, Getform, un endpoint serverless)
   *     que guarde el registro de consentimientos incluido en "consents".
   * ------------------------------------------------------------------ */
  forms: {
    endpoint: ''
  },

  /* ------------------------------------------------------------------
   * CONSENTIMIENTO DE COOKIES
   * categories: tecnologías OPCIONALES que el sitio realmente usa.
   *   - Array vacío → el sitio no usa nada opcional: no se muestra banner
   *     (mostrarlo sin necesidad sería un "banner de relleno").
   *   - Para activar analítica, añade una categoría. El script NO se carga hasta que la
   *     persona la acepta, y deja de cargarse si la rechaza o la retira.
   *
   * Ejemplo (descomenta y adapta; luego actualiza cookies.html con las cookies reales):
   *
   * categories: [
   *   {
   *     id: 'analytics',
   *     label: 'Analítica',
   *     description: 'Nos ayuda a entender qué páginas se visitan para mejorar el sitio.',
   *     scripts: [
   *       { src: 'https://plausible.io/js/script.js', attrs: { defer: '', 'data-domain': 'tudominio.cl' } }
   *     ]
   *   }
   * ]
   * ------------------------------------------------------------------ */
  consent: {
    storageKey: 'cadencia.consent.v1',
    maxAgeDays: 180,
    categories: []
  }
};
