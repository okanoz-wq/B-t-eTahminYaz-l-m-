import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useApiData } from '../api/hooks.js';
import { paraMilyar, toMilyar } from '../lib/format.js';
import { trFormat } from '../lib/animations.js';
import { enIyiModel, tahminBul } from '../lib/modelUtils.js';
import { applyChartDefaults, Chart } from '../lib/chartSetup.js';

export default function SenaryoKarsilastirma() {
  const { data: kalemler, loading: l1 } = useApiData(() => api.butceKalemleri(), []);
  const { data: backtest, loading: l2 } = useApiData(() => api.backtesting(), []);
  const { data: tahmin2026, loading: l3 } = useApiData(() => api.tahminSonucu({ yil: 2026, senaryo: 'Baz' }), []);

  const [secili, setSecili] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!secili && kalemler && kalemler.length) setSecili(kalemler[0].id);
  }, [kalemler, secili]);

  const zenginKalemler = useMemo(() => {
    if (!kalemler) return [];
    return kalemler.map((k) => {
      const enIyi = enIyiModel(k.ad, backtest);
      const tahmin = enIyi ? tahminBul(k.ad, enIyi.model, tahmin2026) : null;
      return { ...k, enIyi, tahmin };
    });
  }, [kalemler, backtest, tahmin2026]);

  const toplamBaz = zenginKalemler.reduce((acc, k) => acc + (k.tahmin?.tahminTutari || 0), 0);
  const toplam2025 = zenginKalemler.reduce((acc, k) => acc + (k.sonYilToplam || 0), 0);
  const buyume = toplam2025 ? ((toplamBaz - toplam2025) / toplam2025) * 100 : 0;

  const kalem = zenginKalemler.find((k) => k.id === secili);

  useEffect(() => {
    if (!canvasRef.current || !kalem) return;
    applyChartDefaults();
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: ['2025 gerçekleşen', 'Baz senaryo · 2026 (reel)'],
        datasets: [{
          data: [toMilyar(kalem.sonYilToplam), kalem.tahmin ? toMilyar(kalem.tahmin.tahminTutari) : null],
          backgroundColor: ['#5b9dff', '#4ade80'],
          borderRadius: 8, barThickness: 64,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8b96a8' } },
          y: { grid: { color: '#1a2230' }, ticks: { color: '#8b96a8', callback: (v) => v + ' mlyr' } },
        },
        plugins: { tooltip: { callbacks: { label: (ctx) => ' ' + trFormat(ctx.parsed.y, 1) + ' mlyr ₺' } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [kalem]);

  const loading = l1 || l2 || l3;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Senaryo karşılaştırma</h1>
          <p>Şu an yalnızca Baz senaryo (gerçek modellerden üretilmiş) mevcut</p>
        </div>
      </div>

      <div className="alert warning reveal reveal-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <p>
          <strong>İyimser</strong> ve <strong>Kötümser</strong> senaryolar henüz üretilmedi — şu an veritabanında sadece
          gerçek modellerin ürettiği <strong>Baz</strong> senaryo var (son 12 ayın ortalaması sabit kalacak şekilde
          varsayılan döviz/altın/enflasyon). İyimser/kötümser için farklı makro varsayımlarıyla
          <code>tahmin_2026_uret_ve_kaydet.py</code> tekrar çalıştırılabilir.
        </p>
      </div>

      <div className="grid grid-3 reveal reveal-1" style={{ marginBottom: 22 }}>
        <div className="scenario-card">
          <span className="scenario-tag" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>İYİMSER</span>
          <p className="kpi-label" style={{ marginTop: 4 }}>Durum</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.7 }}>Henüz üretilmedi</p>
          <p className="stat-label">Toplam 2026 tahmini</p>
          <p className="kpi-value" style={{ color: 'var(--text-muted)' }}>—</p>
        </div>
        <div className="scenario-card featured">
          <span className="scenario-tag" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>BAZ</span>
          <p className="kpi-label" style={{ marginTop: 4 }}>Varsayım</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.7 }}>Reel kur / reel altın / enflasyon, son 12 ayın ortalamasında sabit</p>
          <p className="stat-label">Toplam 2026 tahmini (reel)</p>
          <p className="kpi-value">{loading ? '…' : paraMilyar(toplamBaz)}</p>
          <span className={`kpi-delta ${buyume >= 0 ? 'up' : 'down'}`}>2025'e göre {buyume >= 0 ? '+' : ''}{trFormat(buyume, 1)}%</span>
        </div>
        <div className="scenario-card">
          <span className="scenario-tag" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>KÖTÜMSER</span>
          <p className="kpi-label" style={{ marginTop: 4 }}>Durum</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.7 }}>Henüz üretilmedi</p>
          <p className="stat-label">Toplam 2026 tahmini</p>
          <p className="kpi-value" style={{ color: 'var(--text-muted)' }}>—</p>
        </div>
      </div>

      <div className="card reveal reveal-2" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Kalem bazında: 2025 gerçekleşen vs Baz 2026</h2>
          <div className="segmented">
            {(kalemler || []).map((k) => (
              <button key={k.id} className={k.id === secili ? 'active' : ''} onClick={() => setSecili(k.id)}>
                {k.ad.replace(/ giderleri| gideri/i, '')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 260 }}>
          {loading ? <p className="state-msg">Yükleniyor…</p> : <canvas ref={canvasRef}></canvas>}
        </div>
      </div>

      <h2 className="section-title reveal reveal-3">Tüm kalemler — Baz senaryo tablosu</h2>
      <div className="table-wrap reveal reveal-3">
        <table>
          <thead><tr><th>Kalem</th><th style={{ textAlign: 'right' }}>2025 gerçekleşen</th><th style={{ textAlign: 'right' }}>Baz · 2026 (reel)</th><th style={{ textAlign: 'right' }}>Değişim</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="state-msg">Yükleniyor…</td></tr>}
            {!loading && zenginKalemler.map((k) => {
              const degisim = k.sonYilToplam ? (((k.tahmin?.tahminTutari || 0) - k.sonYilToplam) / k.sonYilToplam) * 100 : null;
              return (
                <tr key={k.id}>
                  <td className="cell-primary">{k.ad}</td>
                  <td style={{ textAlign: 'right' }}>{paraMilyar(k.sonYilToplam)}</td>
                  <td style={{ textAlign: 'right' }}>{k.tahmin ? paraMilyar(k.tahmin.tahminTutari) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{degisim !== null ? <span className={`badge ${degisim >= 0 ? 'success' : 'danger'}`}>{degisim >= 0 ? '+' : ''}{trFormat(degisim, 1)}%</span> : '—'}</td>
                </tr>
              );
            })}
            {!loading && (
              <tr style={{ fontWeight: 600 }}>
                <td className="cell-primary">Toplam</td>
                <td style={{ textAlign: 'right' }}>{paraMilyar(toplam2025)}</td>
                <td style={{ textAlign: 'right' }}>{paraMilyar(toplamBaz)}</td>
                <td style={{ textAlign: 'right' }}><span className="badge neutral">{buyume >= 0 ? '+' : ''}{trFormat(buyume, 1)}%</span></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
