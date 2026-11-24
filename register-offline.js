(() => {
  'use strict';

  // Browsers consider loopback secure, allowing the packaged site to be tested locally.
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!window.isSecureContext || (location.protocol !== 'https:' && !loopback)) return;

  function register() {
    try {
      navigator.serviceWorker?.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {
        // The regular page can run without offline navigation.
      });
    } catch {
      // Some embedded browsers restrict access to service workers.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else register();
})();
