import { useCallback, useEffect, useRef, useState } from 'react';
import { loadTracks } from './api.js';
import { useLang } from './i18n/LanguageContext.jsx';

// A dependency list turned into one string, so the effect below can compare
// it without spreading an array into its dependency list.
const keyOf = (deps) =>
  deps.map((d) => (d !== null && typeof d === 'object' ? JSON.stringify(d) : String(d))).join('\u0001');

/**
 * Runs an async loader and tracks loading / error / data.
 * Re-runs when `deps` change or when `reload()` is called.
 * The loader is read through a ref, so callers can pass an inline function.
 */
export function useAsync(loader, deps = []) {
  const loaderRef = useRef(loader);
  const [tick, setTick] = useState(0);
  const depsKey = keyOf(deps);
  const requestKey = `${tick}|${depsKey}`;
  const [result, setResult] = useState({ key: null, error: null, data: null });

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => !cancelled && setResult({ key: requestKey, error: null, data }))
      .catch((error) => !cancelled && setResult({ key: requestKey, error, data: null }));
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const setData = useCallback(
    (updater) => setResult((r) => ({ ...r, data: typeof updater === 'function' ? updater(r.data) : updater })),
    []
  );

  const settled = result.key === requestKey;
  return {
    loading: !settled,
    error: settled ? result.error : null,
    data: settled ? result.data : null,
    reload,
    setData,
  };
}

export function useTracks() {
  return useAsync(loadTracks, []);
}

export function useErrorText() {
  const { t } = useLang();
  return (error) => {
    if (!error) return '';
    const code = error.code || 'default';
    const text = t(`errors.${code}`);
    return text === `errors.${code}` ? t('errors.default') : text;
  };
}
