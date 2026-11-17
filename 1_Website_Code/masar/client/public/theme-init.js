// Apply the saved theme before the first paint. The site opens in light
// mode; dark mode is used only when the visitor has switched to it.
(function () {
  var t = null;
  try { t = localStorage.getItem('masar.theme'); } catch (e) {}
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
})();
