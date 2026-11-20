"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api-client";

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!url) {
        setLoading(false);
        return;
      }
      const current = ++version.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await apiFetch<T>(url);
        if (current === version.current) setData(result);
      } catch (loadError) {
        if (current === version.current) setError(errorMessage(loadError));
      } finally {
        if (current === version.current) setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { data, setData, loading, error, reload: load };
}
