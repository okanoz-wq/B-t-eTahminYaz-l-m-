import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApiData } from '../api/hooks.js';
import { paraMilyar, yuzde, toMilyar } from '../lib/format.js';
import { trFormat } from '../lib/animations.js';
import { enIyiModel, modelSatirlariGetir, tahminBul, badgeSinifi } from '../lib/modelUtils.js';
import { applyChartDefaults, chartGradient, Chart } from '../lib/chartSetup.js';

function yillikToplaminaCevir(gecmis) {
  const yillar = {};
  gecmis.forEach((g) => {
    if (!yillar[g.yil]) yillar[g.yil] = { toplam: 0, tahminiMi: false };
    yillar[g.yil].toplam += g.tutar;
    if (g.veriKaynagi !== 'Gerçek') yillar[g.yil].tahminiMi = true;
  });
  return Object.entries(yillar)
    .map(([yil, v]) => ({ yil: Number(yil), toplam: v.toplam, tahminiMi: v.tahminiMi }))
    .sort((a, b) => a.yil - b.yil);
}

export default function KalemDetay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const kalemId = Number(id);

  const { data: kalemler } = useApiData(() => api.butceKalemleri(), []);
  const { data: gecmisVeri, loading: l2, error: e2 } = useApiData(() => api.gerceklesenDeger({ kalemId }), [kalemId]);
  const { data: backtest } = useApiData(() => api.backtesting(), []);
  const { data: tahmin2026 } = useApiData(() => api.tahminSonucu({ kalemId, yil: 2026 }), [kalemId]);
  const { data: usdTryTarih } = useApiData(() => api.makroGosterge({ gosterge: 'USDTRY' }), []);

  const [kurGoster, setKurGoster] = useState(true);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const kalem = useMemo(() => (kalemler || []).find((k) => k.id === kalemId), [kalemler, kalemId]);
  const yillikVeri = useMemo(() => (gecmisVeri ? yillikToplaminaCevir(gecmisVeri) : []), [gecmisVeri]);
  const enIyi = kalem ? enIyiModel(kalem.ad, backtest) : null;
  const modelSatirlari = kalem ? modelSatirlariGetir(kalem.ad, backtest) : [];
  const tahmin2026Satiri = enIyi ? tahminBul(kalem.ad, enIyi.model, tahmin2026) : null;

  const cagr = useMemo(() => {
    if (yillikVeri.length < 2) return null;
    const ilk = yillikVeri[0].toplam;
    const son = yillikVeri[yillikVeri.length - 1].toplam;
    if (!ilk || ilk <= 0) return null;
    const n = yillikVeri.length - 1;
    return (Math.pow(son / ilk, 1 / n) - 1) * 100;
  }, [yillikVeri]);

  const kismenTahmini = yillikVeri.some((y) => y.tahminiMi);

  // yil sonu USD/TRY (yaklasik: o yilin son ayindaki deger)
  const usdTryYilSonu = useMemo(() => {
    if (!usdTryTarih) return {};
    const sonuc = {};
    usdTryTarih.forEach((row) => {
      const yil = new Date(row.tarih).getFullYear();
      sonuc[yil] = row.deger; // liste tarihe gore sirali geldigi icin son deger kalir
    });
    return sonuc;
  }, [usdTryTarih]);

  useEffect(() => {
    if (!canvasRef.current || yillikVeri.length === 0) return;
    applyChartDefaults();
    if (chartRef.current) chartRef.current.destroy();

    const yillar = yillikVeri.map((y) => y.yil);
    const gercekMilyar = yillikVeri.map((y) => toMilyar(y.toplam));
    const tahminEkli = tahmin2026Satiri ? [...yillar, 2026] : yillar;
    const gercekSeri = tahmin2026Satiri
      ? [...gercekMilyar, null]
      : gercekMilyar;
    const tahminSeri = tahmin2026Satiri
      ? [...Array(gercekMilyar.length - 1).fill(null), gercekMilyar[gercekMilyar.length - 1], toMilyar(tahmin2026Satiri.tahminTutari)]
      : [];

    const datasets = [{
      label: 'Gerçekleşen',
      data: gercekSeri,
      borderColor: '#4ade80',
      backgroundColor: (ctx) => {
        const { chart } = ctx; const { ctx: c, chartArea } = chart;
        if (!chartArea) return null;
        return chartGradient(c, chartArea, '#4ade8033', '#4ade8000');
      },
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#4ade80',
      tension: 0.35,
      fill: true,
      yAxisID: 'y',
      segment: {
        borderDash: (ctx) => (yillikVeri[ctx.p0DataIndex]?.tahminiMi || yillikVeri[ctx.p1DataIndex]?.tahminiMi) ? [6, 4] : undefined,
      },
    }];

    if (tahmin2026Satiri) {
      datasets.push({
        label: `Tahmin (${enIyi?.model || ''})`,
        data: tahminSeri,
        borderColor: '#5b9dff',
        borderWidth: 2.5,
        borderDash: [5, 4],
        pointRadius: 3,
        pointBackgroundColor: '#5b9dff',
        tension: 0.35,
        fill: false,
        yAxisID: 'y',
      });
    }

    if (kurGoster) {
      datasets.push({
        label: 'USD/TRY',
        data: tahminEkli.map((yil) => usdTryYilSonu[yil] ?? null),
        borderColor: '#a78bfa',
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        yAxisID: 'y1',
      });
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels: tahminEkli, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { color: '#1a2230' }, ticks: { color: '#8b96a8' } },
          y: { position: 'left', grid: { color: '#1a2230' }, ticks: { color: '#8b96a8', callback: (v) => v + ' mlyr' } },
          y1: { position: 'right', display: kurGoster, grid: { display: false }, ticks: { color: '#a78bfa' } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label === 'USD/TRY'
                ? ' USD/TRY ≈ ' + ctx.parsed.y?.toFixed(2)
                : ' ' + ctx.dataset.label + ': ' + trFormat(ctx.parsed.y, 1) + ' mlyr ₺',
            },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [yillikVeri, tahmin2026Satiri, kurGoster, usdTryYilSonu, enIyi]);

  if (e2) return <p className="state-msg error">Veri alınamadı: {e2}</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{kalem ? kalem.ad : 'Yükleniyor…'}</h1>
          <p>Gerçek zamanlı veritabanı bağlantısı · aylık gerçekleşen değerlerden yıllık toplamlar</p>
        </div>
        <div className="topbar-actions">
          <span className="chip" style={{ cursor: 'pointer' }} onClick={() => navigate('/kalemler')}>← Kalem listesi</span>
        </div>
      </div>

      <div className="segmented reveal reveal-1" style={{ marginBottom: 20 }}>
        {(kalemler || []).map((k) => (
          <button key={k.id} className={k.id === kalemId ? 'active' : ''} onClick={() => navigate(`/kalemler/${k.id}`)}>
            {k.ad.replace(/ giderleri| gideri/i, '')}
          </button>
        ))}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card hoverable reveal reveal-2">
          <div className="kpi-label">Son yıl gerçekleşen</div>
          <div className="kpi-value">{kalem ? paraMilyar(kalem.sonYilToplam) : '—'}</div>
        </div>
        <div className="card hoverable reveal reveal-2">
          <div className="kpi-label">10 yıllık CAGR</div>
          <div className="kpi-value">{cagr !== null ? yuzde(cagr) : '—'}</div>
        </div>
        <div className="card hoverable reveal reveal-3">
          <div className="kpi-label">Veri kaynağı</div>
          <div className="kpi-value" style={{ fontSize: 16 }}>
            <span className={`badge ${kismenTahmini ? 'warning' : 'success'}`}>{kismenTahmini ? 'Kısmen tahmini' : 'Gerçek (KAP)'}</span>
          </div>
        </div>
        <div className="card hoverable reveal reveal-3">
          <div className="kpi-label">Önerilen model</div>
          <div className="kpi-value" style={{ fontSize: 16 }}>
            {enIyi ? <span className={`badge ${badgeSinifi(enIyi.mape)}`}>{enIyi.model}</span> : '—'}
          </div>
        </div>
      </div>

      <div className="card reveal reveal-3" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Geçmiş gerçekleşen değerler + 2026 tahmini</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={kurGoster} onChange={(e) => setKurGoster(e.target.checked)} /> USD/TRY yıl sonu göster
          </label>
        </div>
        <div style={{ height: 320 }}>
          {l2 ? <p className="state-msg">Yükleniyor…</p> : <canvas ref={canvasRef}></canvas>}
        </div>
        <div className="legend">
          <div className="legend-item"><span className="legend-dot" style={{ background: '#4ade80' }}></span>Gerçekleşen tutar</div>
          {tahmin2026Satiri && <div className="legend-item"><span className="legend-dot" style={{ background: '#5b9dff' }}></span>2026 tahmini (reel)</div>}
          <div className="legend-item"><span className="legend-dot" style={{ background: '#a78bfa' }}></span>USD/TRY (sağ eksen, gerçek TCMB verisi)</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: 'transparent', border: '1px dashed #8b96a8' }}></span>Kesikli = tahmini değer</div>
        </div>
        <p className="footnote">2020 sonrası Enerji giderleri kısmen tahminidir (veri_kaynagi alanı ile işaretli). 2026 değeri, backtest'te en düşük MAPE'e sahip model ({enIyi?.model || '—'}) ile üretilmiş, Aralık 2025 alım gücüne göre reel tutardır.</p>
      </div>

      {modelSatirlari.length > 0 && (
        <>
          <h2 className="section-title reveal reveal-4">Model karşılaştırması (backtesting)</h2>
          <div className="table-wrap reveal reveal-4">
            <table>
              <thead><tr><th>Model</th><th style={{ textAlign: 'right' }}>MAPE</th><th style={{ textAlign: 'right' }}>RMSE</th><th></th></tr></thead>
              <tbody>
                {modelSatirlari.map((m) => (
                  <tr key={m.model}>
                    <td className="cell-primary">{m.model}</td>
                    <td style={{ textAlign: 'right' }}>{yuzde(m.mape)}</td>
                    <td style={{ textAlign: 'right' }}>{trFormat(m.rmse, 0)}</td>
                    <td>{enIyi && m.model === enIyi.model ? <span className="badge success">Önerilen</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
