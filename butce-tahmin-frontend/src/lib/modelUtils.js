// backtest = [{kalem, model, mape, rmse, hesaplamaTarihi}, ...]  (yil=2025 satirlari)
// tahminler = [{kalem, model, tahminYili, senaryo, tahminTutari, guvenAraligiAlt, guvenAraligiUst}, ...]

export function enIyiModel(kalemAdi, backtest) {
  const satirlar = (backtest || []).filter((b) => b.kalem === kalemAdi);
  if (!satirlar.length) return null;
  return satirlar.reduce((a, b) => (b.mape < a.mape ? b : a));
}

export function modelSatirlariGetir(kalemAdi, backtest) {
  return (backtest || []).filter((b) => b.kalem === kalemAdi);
}

export function tahminBul(kalemAdi, modelAdi, tahminler) {
  return (tahminler || []).find((t) => t.kalem === kalemAdi && t.model === modelAdi) || null;
}

export function badgeSinifi(mape) {
  if (mape === null || mape === undefined) return 'neutral';
  if (mape <= 30) return 'success';
  if (mape <= 50) return 'warning';
  return 'danger';
}
