// Sends every /api call the app makes to the in-browser demo API instead of
// the network. Imported before the app, so its first request is already covered.
import { handle } from './server.js';

const realFetch = window.fetch.bind(window);
const pause = () => new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 120)); // feels like a real server

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const at = url.indexOf('/api/');
  if (at === -1 || (at > 0 && !url.startsWith(location.origin))) return realFetch(input, init);
  await pause();
  return handle((init.method || 'GET').toUpperCase(), url.slice(at + 4), new Headers(init.headers), init.body);
};

// No-login demo (VITE_DEMO_GUEST=1): the visitor is signed in before the app
// starts, and the sign-in, account and supervisor screens are skipped.
if (import.meta.env.VITE_DEMO_GUEST) {
  const { guestToken } = await import('./server.js');
  const { DEMO_GUEST } = await import('./seed.js');
  try {
    localStorage.setItem('masar.token', guestToken(DEMO_GUEST.email));
  } catch {
    /* storage blocked: the app shows the sign-in screen instead */
  }
  document.documentElement.dataset.demoGuest = '';
  const HIDDEN = ['/login', '/register', '/account', '/admin'];
  const skipHidden = () => {
    const path = location.hash.replace(/^#/, '').split('?')[0];
    if (HIDDEN.includes(path)) location.replace('#/dashboard');
  };
  skipHidden();
  window.addEventListener('hashchange', skipHidden);
}
