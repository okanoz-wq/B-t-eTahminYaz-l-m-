import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useApiData } from '../api/hooks.js';
import { paraMilyar, yuzde, toMilyar } from '../lib/format.js';
import { trFormat } from '../lib/animations.js';
import { modelSatirlariGetir, enIyiModel, badgeSinifi } from '../lib/modelUtils.js';
import { applyChartDefaults, Chart } from '../lib/chartSetup.js';

const MODEL_RENK = { HareketliOrtalama: '#8b96a8', SARIMAX: '#f5a623', RandomForest: '#4ade80' };

export default function TahminSonuc() {
  const { data: kalemler, loading: l1 } = useApiData(() => api.butceKalemleri(), []);
  const { data: backtest, loading: l2 } = useApiData(() => api.backtesting(), []);
  const { data: tahmin2026, loading: l3 } = useApiData(() => api.tahminSonucu({ yil: 2026 }), []);

  const [secili, setSecili] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!secili && kalemler && kalemler.length) setSecili(kalemler[0].id);
  }, [kalemler, secili]);

  const kalem = (kalemler || []).find((k) => k.id === secili);
  const modelSatirlari = kalem ? modelSatirlariGetir(kalem.ad, backtest) : [];
  const enIyi = kalem ? enIyiModel(kalem.ad, backtest) : null;
  const tahminSatirlari = kalem ? (tahmin2026 || []).filter((t) => t.kalem === kalem.ad) : [];

  useEffect(() => {
    if (!canvasRef.current || !kalem) return;
    applyChartDefaults();
    if (chartRef.current) chartRef.current.destroy();

    const modelSirasi = ['HareketliOrtalama', 'SARIMAX', 'RandomForest'];
    const labels = ['Gerçekleşen 2025', ...modelSirasi.map((m) => m + ' · 2026')];
    const data = [
      toMilyar(kalem.sonYilToplam),
      ...modelSirasi.map((m) => {
        const t = tahminSatirlari.find((x) => x.model === m);
        return t ? toMilyar(t.tahminTutari) : null;
      }),
    ];
    const renkler = ['#5b9dff', ...modelSirasi.map((m) => MODEL_RENK[m])];

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: renkler, borderRadius: 8, barThickness: 56 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8b96a8' } },
          y: { grid: { color: '#1a2230' }, ticks: { color: '#8b96a8', callback: (v) => v + ' mlyr' } },
        },
        plugins: { tooltip: { callbacks: { label: (ctx) => ' ' + trFormat(ctx.parsed.y, 1) + ' mlyr ₺ (reel)' } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [kalem, tahminSatirlari]);

  const loading = l1 || l2 || l3;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Tahmin sonuçları</h1>
          <p>Backtest karşılaştırması (2025) ve gerçek 2026 tahminleri · veritabanından canlı</p>
        </div>
      </div>

      <div className="segmented reveal reveal-1" style={{ marginBottom: 20 }}>
        {(kalemler || []).map((k) => (
          <button key={k.id} className={k.id === secili ? 'active' : ''} onClick={() => setSecili(k.id)}>
            {k.ad.replace(/ giderleri| gideri/i, '')}
          </button>
        ))}
      </div>

      <div className="card reveal reveal-2" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 className="section-title" style={{ margin: 0 }}>{kalem ? kalem.ad : ''} · 2025 gerçekleşen ile 2026 model tahminleri</h2>
          {enIyi && <span className={`badge ${badgeSinifi(enIyi.mape)}`}>Önerilen: {enIyi.model} · MAPE {yuzde(enIyi.mape)}</span>}
        </div>
        <div style={{ height: 300 }}>
          {loading ? <p className="state-msg">Yükleniyor…</p> : <canvas ref={canvasRef}></canvas>}
        </div>
        <p className="footnote">2026 tahminleri reel (Aralık 2025 alım gücüne göre sabit fiyatlarla) hesaplanmıştır; gelecek yılın enflasyonu bilinmediği için bu, ekstra bir varsayım eklemeden en savunulabilir gösterimdir.</p>
      </div>

      <h2 className="section-title reveal reveal-3">Model karşılaştırması (backtesting — 2025'in son 12 ayı)</h2>
      <div className="table-wrap reveal reveal-3" style={{ marginBottom: 12 }}>
        <table>
          <thead><tr><th>Model</th><th style={{ textAlign: 'right' }}>MAPE</th><th style={{ textAlign: 'right' }}>RMSE</th><th style={{ textAlign: 'right' }}>2026 tahmini (reel)</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="state-msg">Yükleniyor…</td></tr>}
            {!loading && modelSatirlari.map((m) => {
              const t = tahminSatirlari.find((x) => x.model === m.model);
              return (
                <tr key={m.model}>
                  <td className="cell-primary">{m.model}</td>
                  <td style={{ textAlign: 'right' }}>{yuzde(m.mape)}</td>
                  <td style={{ textAlign: 'right' }}>{trFormat(m.rmse, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{t ? paraMilyar(t.tahminTutari) : '—'}</td>
                  <td>{enIyi && m.model === enIyi.model ? <span className="badge success">Önerilen</span> : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="footnote reveal reveal-3">Gerçek backtesting sonuçları — <code>model_prototip.py</code> ve <code>backtest_sonuclarini_kaydet.py</code> çalıştırmalarından, veritabanına yazılmış hâliyle. En düşük MAPE önerilen model olarak işaretlenir.</p>
    </>
  );
}
