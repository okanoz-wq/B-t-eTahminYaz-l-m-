import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApiData } from '../api/hooks.js';
import { paraMilyar, yuzde } from '../lib/format.js';
import { enIyiModel, tahminBul, badgeSinifi } from '../lib/modelUtils.js';

export default function KalemListesi() {
  const { data: kalemler, loading: l1, error: e1 } = useApiData(() => api.butceKalemleri(), []);
  const { data: backtest, loading: l2 } = useApiData(() => api.backtesting(), []);
  const { data: tahmin2026, loading: l3 } = useApiData(() => api.tahminSonucu({ yil: 2026 }), []);
  const navigate = useNavigate();

  const [arama, setArama] = useState('');
  const [turFilter, setTurFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const loading = l1 || l2 || l3;

  const satirlar = useMemo(() => {
    if (!kalemler) return [];
    return kalemler.map((k) => {
      const enIyi = enIyiModel(k.ad, backtest);
      const tahmin = enIyi ? tahminBul(k.ad, enIyi.model, tahmin2026) : null;
      return { ...k, enIyi, tahmin };
    });
  }, [kalemler, backtest, tahmin2026]);

  const filtreli = satirlar.filter((s) => {
    const adUyum = s.ad.toLowerCase().includes(arama.toLowerCase());
    const turUyum = !turFilter || s.tur === turFilter;
    const modelUyum = !modelFilter || s.enIyi?.model === modelFilter;
    return adUyum && turUyum && modelUyum;
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Bütçe kalemleri</h1>
          <p>Tüm gider/gelir kalemlerinin listesi · arama ve filtreleme</p>
        </div>
      </div>

      <div className="toolbar reveal reveal-1">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Kalem adı ara…" value={arama} onChange={(e) => setArama(e.target.value)} />
        </div>
        <select className="select" value={turFilter} onChange={(e) => setTurFilter(e.target.value)}>
          <option value="">Tüm türler</option>
          <option value="Gider">Gider</option>
          <option value="Gelir">Gelir</option>
        </select>
        <select className="select" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
          <option value="">Tüm modeller</option>
          <option value="RandomForest">RandomForest</option>
          <option value="SARIMAX">SARIMAX</option>
          <option value="HareketliOrtalama">HareketliOrtalama</option>
        </select>
      </div>

      <div className="table-wrap reveal reveal-2">
        <table>
          <thead>
            <tr>
              <th>Kalem</th>
              <th>Tür</th>
              <th>Departman</th>
              <th style={{ textAlign: 'right' }}>2025 gerçekleşen</th>
              <th style={{ textAlign: 'right' }}>2026 tahmini (reel)</th>
              <th>Önerilen model</th>
              <th style={{ textAlign: 'right' }}>MAPE</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="state-msg">Yükleniyor…</td></tr>}
            {e1 && <tr><td colSpan={7} className="state-msg error">Veri alınamadı: {e1}</td></tr>}
            {!loading && filtreli.map((s) => (
              <tr key={s.id} onClick={() => navigate(`/kalemler/${s.id}`)}>
                <td className="cell-primary">{s.ad}</td>
                <td><span className="badge danger">{s.tur}</span></td>
                <td className="cell-muted">{s.departman}</td>
                <td style={{ textAlign: 'right' }}>{paraMilyar(s.sonYilToplam)}</td>
                <td style={{ textAlign: 'right' }}>{s.tahmin ? paraMilyar(s.tahmin.tahminTutari) : '—'}</td>
                <td>{s.enIyi ? <span className={`badge ${badgeSinifi(s.enIyi.mape)}`}>{s.enIyi.model}</span> : '—'}</td>
                <td style={{ textAlign: 'right' }}>{s.enIyi ? yuzde(s.enIyi.mape) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && filtreli.length === 0 && (
        <p className="footnote" style={{ textAlign: 'center', padding: '24px 0' }}>Eşleşen kalem bulunamadı.</p>
      )}
    </>
  );
}
