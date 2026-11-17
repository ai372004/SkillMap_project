// Apply the saved theme before the first paint. The site opens in light
// mode; dark mode is used only when the visitor has switched to it.
// Dark mode is switched off for now; keep this in step with
// DARK_MODE_ENABLED in src/theme/ThemeContext.jsx.
(function () {
  var DARK_MODE_ENABLED = false;
  var t = null;
  try { t = localStorage.getItem('masar.theme'); } catch (e) {}
  document.documentElement.setAttribute('data-theme', DARK_MODE_ENABLED && t === 'dark' ? 'dark' : 'light');
})();
