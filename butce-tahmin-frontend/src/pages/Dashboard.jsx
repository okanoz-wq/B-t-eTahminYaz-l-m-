import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApiData } from '../api/hooks.js';
import { useCountUp, trFormat } from '../lib/animations.js';
import { toMilyar, paraMilyar, yuzde } from '../lib/format.js';
import { enIyiModel, tahminBul, badgeSinifi } from '../lib/modelUtils.js';
import { applyChartDefaults, chartGradient, Chart } from '../lib/chartSetup.js';

function Sparkline({ data, color }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    applyChartDefaults();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return null;
            return chartGradient(c, chartArea, color + '33', color + '00');
          },
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { display: false }, y: { display: false } },
        plugins: { tooltip: { enabled: false } },
        elements: { line: { borderJoinStyle: 'round' } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data, color]);

  return <canvas className="sparkline" ref={canvasRef}></canvas>;
}

function Kpi({ label, value, decimals, suffix, prefix, delta, deltaUp, badge, reveal, ready }) {
  const animated = useCountUp(value, { decimals, ready });
  return (
    <div className={`card hoverable reveal ${reveal}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        <span>{prefix || ''}{animated}{suffix || ''}</span>
      </div>
      {delta && <span className={`kpi-delta ${deltaUp ? 'up' : 'down'}`}>{delta}</span>}
      {badge && <span className="badge neutral">{badge}</span>}
    </div>
  );
}

const KAYNAK_RENK = { Enflasyon: 'var(--blue)', USDTRY: 'var(--accent)', Altin: 'var(--amber)' };
const KAYNAK_ETIKET = { Enflasyon: 'Yıllık enflasyon (TÜFE)', USDTRY: 'USD/TRY', Altin: 'Gram altın' };

export default function Dashboard() {
  const { data: kalemler, loading: l1, error: e1 } = useApiData(() => api.butceKalemleri(), []);
  const { data: tahmin2026, loading: l2, error: e2 } = useApiData(() => api.tahminSonucu({ yil: 2026 }), []);
  const { data: backtest, loading: l3, error: e3 } = useApiData(() => api.backtesting(), []);
  const { data: makroSon, loading: l4, error: e4 } = useApiData(() => api.makroGostergeSon(), []);
  const { data: tumGerceklesen, loading: l5 } = useApiData(() => api.gerceklesenDeger(), []);

  const loading = l1 || l2 || l3 || l4 || l5;
  const error = e1 || e2 || e3 || e4;

  const zenginKalemler = useMemo(() => {
    if (!kalemler || !backtest || !tahmin2026) return [];
    return kalemler.map((k) => {
      const en_iyi = enIyiModel(k.ad, backtest);
      const tahmin = en_iyi ? tahminBul(k.ad, en_iyi.model, tahmin2026) : null;
      const gecmis = (tumGerceklesen || [])
        .filter((g) => g.kalemId === k.id)
        .sort((a, b) => a.yil - b.yil || a.ay - b.ay);
      const son12 = gecmis.slice(-12).map((g) => g.tutar);
      const kismenTahmini = gecmis.some((g) => g.veriKaynagi !== 'Gerçek');
      return { ...k, enIyi: en_iyi, tahmin, son12, kismenTahmini };
    });
  }, [kalemler, backtest, tahmin2026, tumGerceklesen]);

  const toplam2025 = useMemo(
    () => zenginKalemler.reduce((acc, k) => acc + (k.sonYilToplam || 0), 0),
    [zenginKalemler]
  );
  const toplam2026 = useMemo(
    () => zenginKalemler.reduce((acc, k) => acc + (k.tahmin?.tahminTutari || 0), 0),
    [zenginKalemler]
  );
  const ortalamaMape = useMemo(() => {
    const mapeler = zenginKalemler.map((k) => k.enIyi?.mape).filter((m) => m !== undefined && m !== null);
    if (!mapeler.length) return 0;
    return mapeler.reduce((a, b) => a + b, 0) / mapeler.length;
  }, [zenginKalemler]);

  const enYuksekMapeKalem = useMemo(() => {
    if (!zenginKalemler.length) return null;
    return zenginKalemler.reduce((a, b) => ((b.enIyi?.mape || 0) > (a.enIyi?.mape || 0) ? b : a));
  }, [zenginKalemler]);

  const buyumeYuzdesi = toplam2025 ? ((toplam2026 - toplam2025) / toplam2025) * 100 : 0;

  const sparkRenkleri = ['#4ade80', '#5b9dff', '#a78bfa', '#f5a623'];

  if (error) return <p className="state-msg error">Veri alınamadı: {error}</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Merhaba, Okan</h1>
          <p>Arçelik örnek verisiyle bütçe tahmin özeti · gerçek zamanlı API bağlantısı</p>
        </div>
        <div className="topbar-actions">
          <span className="chip">2025 gerçekleşen</span>
          <Link className="chip primary" to="/tahmin">Tahmin sonuçlarını gör</Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <Kpi label="2025 toplam gider" value={toMilyar(toplam2025)} decimals={1} suffix=" mlyr ₺"
          reveal="reveal-1" ready={!loading} delta={!loading ? `2026 tahmini +${trFormat(buyumeYuzdesi, 1)}%` : null} deltaUp />
        <Kpi label="2026 tahmini toplam (reel)" value={toMilyar(toplam2026)} decimals={1} suffix=" mlyr ₺"
          reveal="reveal-2" ready={!loading} delta="En iyi modellerin toplamı" deltaUp />
        <Kpi label="İzlenen kalem" value={zenginKalemler.length} reveal="reveal-3" ready={!loading}
          badge="Backtest ile doğrulanmış" />
        <Kpi label="Ortalama model hatası" value={ortalamaMape} decimals={1} suffix="%" reveal="reveal-4"
          ready={!loading} badge="Backtest · MAPE" />
      </div>

      {enYuksekMapeKalem && enYuksekMapeKalem.enIyi?.mape > 40 && (
        <div className="alert warning reveal reveal-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p>
            <strong>{enYuksekMapeKalem.ad}</strong> tahmini yüksek belirsizlik taşıyor (MAPE {yuzde(enYuksekMapeKalem.enIyi.mape)}) —
            kalem detayında geçmiş verileri incelemeni öneririz.
          </p>
        </div>
      )}

      <h2 className="section-title reveal reveal-3">Kalem bazında tahminler <span className="count">{zenginKalemler.length} kalem</span></h2>
      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        {loading && <p className="state-msg">Yükleniyor…</p>}
        {!loading && zenginKalemler.map((k, i) => (
          <Link key={k.id} className="item-card reveal reveal-3 link-reset" to={`/kalemler/${k.id}`}>
            <div className="item-head">
              <div>
                <p className="item-name">{k.ad}</p>
                <p className="item-sub">{k.tur} · {k.departman}{k.kismenTahmini ? ' · kısmen tahmini' : ' · KAP verisi'}</p>
              </div>
              {k.enIyi && (
                <span className={`badge ${badgeSinifi(k.enIyi.mape)}`}>{k.enIyi.model} · {yuzde(k.enIyi.mape)}</span>
              )}
            </div>
            <Sparkline data={k.son12} color={sparkRenkleri[i % sparkRenkleri.length]} />
            <div className="item-stats">
              <div><p className="stat-label">2025 gerçekleşen</p><p className="stat-value">{paraMilyar(k.sonYilToplam)}</p></div>
              <div><p className="stat-label">2026 tahmini (reel)</p><p className="stat-value">{k.tahmin ? paraMilyar(k.tahmin.tahminTutari) : '—'}</p></div>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="section-title reveal reveal-4">Makro göstergeler</h2>
      <div className="table-wrap reveal reveal-4">
        <table>
          <tbody>
            {loading && <tr><td className="state-msg">Yükleniyor…</td></tr>}
            {!loading && (makroSon || []).map((m) => (
              <tr key={m.gosterge}>
                <td style={{ width: '40%' }}><span style={{ color: KAYNAK_RENK[m.gosterge] || 'var(--text-muted)' }}>●</span>&nbsp; {KAYNAK_ETIKET[m.gosterge] || m.gosterge}</td>
                <td className="cell-primary">{trFormat(m.deger, 2)}{m.birim || ''}</td>
                <td className="cell-muted" style={{ textAlign: 'right' }}>TCMB EVDS · {new Date(m.tarih).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
