import { useEffect, useRef, useState } from 'react';

// Genel amacli veri cekme hook'u: [data, {loading, error, reload}] dondurur.
// deps degistiginde otomatik yeniden cagirir (ornegin secilen kalem id'si).
export function useApiData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reloadFlag = useRef(0);

  useEffect(() => {
    let iptal = false;
    setLoading(true);
    setError(null);

    fetchFn()
      .then((sonuc) => {
        if (!iptal) setData(sonuc);
      })
      .catch((err) => {
        if (!iptal) setError(err.message || 'Bilinmeyen hata');
      })
      .finally(() => {
        if (!iptal) setLoading(false);
      });

    return () => {
      iptal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadFlag.current]);

  const reload = () => {
    reloadFlag.current += 1;
    setLoading(true);
  };

  return { data, loading, error, reload };
}
