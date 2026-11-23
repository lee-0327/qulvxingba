(() => {
  'use strict';

  // Browsers consider loopback secure, allowing the packaged site to be tested locally.
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!window.isSecureContext || (location.protocol !== 'https:' && !loopback)) return;

  try {
    navigator.serviceWorker?.register('./sw.js', { scope: './' }).catch(() => {
      // Installation is optional. The regular page can run without offline navigation.
    });
  } catch {
    // Some embedded browsers restrict access to service workers.
  }
})();
