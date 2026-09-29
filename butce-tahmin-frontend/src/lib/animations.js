import { useEffect, useRef, useState } from 'react';

export function trFormat(n, decimals = 0) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Bir sayiyi 0'dan hedefe animasyonlu sayan hook. `ready` false oldugu surece
// beklemede kalir (veri API'den gelene kadar).
export function useCountUp(target, { decimals = 0, duration = 1400, ready = true } = {}) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!ready || target === null || target === undefined || Number.isNaN(target)) return;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(target * easeOutExpo(progress));
      if (progress < 1) frameRef.current = requestAnimationFrame(frame);
    }
    frameRef.current = requestAnimationFrame(frame);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ready, duration]);

  return trFormat(ready ? value : 0, decimals);
}

// Agirlik/oran cubuklarinin genisligini mount olduktan bir sonraki frame'de
// 0 -> hedef yuzdeye animasyonla dolduran hook. Elemana ref baglanir.
export function useWeightBar(pct) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.width = '0%';
    const id = requestAnimationFrame(() => {
      if (ref.current) ref.current.style.width = pct + '%';
    });
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return ref;
}
