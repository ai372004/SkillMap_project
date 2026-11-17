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
