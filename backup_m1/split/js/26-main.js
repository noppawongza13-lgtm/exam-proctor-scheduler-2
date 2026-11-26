/* ==========================================================================
   26-main.js — Application Bootstrap & DOMContentLoaded Listener
   Source: src/main.js (lines 19479 to 19498)
   Order: 26 of 26 (Must be loaded in this exact sequence)
   ========================================================================== */

// === Module: src/main.js ===
/**
 * Main Application Entry Point
 */


function initApp() {
  const root = document.getElementById('app');
  if (root) {
    new AppView(root);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}


