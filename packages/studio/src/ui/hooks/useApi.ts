import { useState, useEffect } from 'react';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:48821';

export async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, init);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export function useApi<T>(
  endpoint: string | null,
  fallback: T,
): { data: T; loading: boolean; error: string | null } {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(!!endpoint);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!endpoint) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(`${API_BASE}${endpoint}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((d: T) => { setData(d); setError(null); })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [endpoint]);

  return { data, loading, error };
}
