import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useApiData } from '../api/hooks.js';
import { trFormat } from '../lib/animations.js';
import { applyChartDefaults, chartGradient, Chart } from '../lib/chartSetup.js';

const GOSTERGELER = [
  { key: 'Enflasyon', label: 'Yıllık enflasyon (TÜFE)', color: '#f5a623', suffix: '%', kod: 'TP.FE.OKTG01' },
  { key: 'USDTRY', label: 'USD/TRY', color: '#5b9dff', suffix: ' ₺', kod: 'TP.DK.USD.A.YTL' },
  { key: 'Altin', label: 'Gram altın (külçe)', color: '#a78bfa', suffix: ' ₺', kod: 'TP.MK.KUL.YTL' },
];

export default function MakroGosterge() {
  const { data: son, loading: l1, error: e1 } = useApiData(() => api.makroGostergeSon(), []);
  const [secili, setSecili] = useState('Enflasyon');
  const { data: tarihce, loading: l2 } = useApiData(() => api.makroGosterge({ gosterge: secili }), [secili]);

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !tarihce) return;
    applyChartDefaults();
    if (chartRef.current) chartRef.current.destroy();

    const meta = GOSTERGELER.find((g) => g.key === secili);
    const labels = tarihce.map((t) => new Date(t.tarih).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }));
    const data = tarihce.map((t) => t.deger);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: meta.label, data, borderColor: meta.color, borderWidth: 2.5, pointRadius: 0,
          tension: 0.3, fill: true,
          backgroundColor: (ctx) => {
            const { chart } = ctx; const { ctx: c, chartArea } = chart;
            if (!chartArea) return null;
            return chartGradient(c, chartArea, meta.color + '33', meta.color + '00');
          },
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#1a2230' }, ticks: { color: '#8b96a8', maxTicksLimit: 14 } },
          y: { grid: { color: '#1a2230' }, ticks: { color: '#8b96a8', callback: (v) => v + meta.suffix } },
        },
        plugins: { tooltip: { callbacks: { label: (ctx) => ' ' + trFormat(ctx.parsed.y, 2) + meta.suffix } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [tarihce, secili]);

  const bul = (key) => (son || []).find((s) => s.gosterge === key);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Makro göstergeler</h1>
          <p>Enflasyon, USD/TRY ve altın fiyatı · TCMB EVDS'ten canlı çekilen aylık seri</p>
        </div>
      </div>

      {e1 && <p className="state-msg error">Veri alınamadı: {e1}</p>}

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {GOSTERGELER.map((g, i) => {
          const veri = bul(g.key);
          return (
            <div className={`card hoverable reveal reveal-${i + 1}`} key={g.key}>
              <div className="kpi-label"><span style={{ color: g.color }}>●</span> {g.label}</div>
              <div className="kpi-value">{veri ? trFormat(veri.deger, 2) + g.suffix : (l1 ? '…' : '—')}</div>
              <p className="footnote">Kaynak: TCMB EVDS · {g.kod}{veri ? ` · son güncelleme ${new Date(veri.tarih).toLocaleDateString('tr-TR')}` : ''}</p>
            </div>
          );
        })}
      </div>

      <div className="card reveal reveal-3" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 className="section-title" style={{ margin: 0 }}>10 yıllık trend (2016–2025, aylık)</h2>
          <div className="segmented">
            {GOSTERGELER.map((g) => (
              <button key={g.key} className={secili === g.key ? 'active' : ''} onClick={() => setSecili(g.key)}>
                {g.key === 'USDTRY' ? 'USD/TRY' : g.key}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 280 }}>
          {l2 ? <p className="state-msg">Yükleniyor…</p> : <canvas ref={canvasRef}></canvas>}
        </div>
        <p className="footnote">Veri TCMB EVDS'ten aylık ortalama olarak çekilmiştir (frequency=5, aggregation=avg).</p>
      </div>
    </>
  );
}
