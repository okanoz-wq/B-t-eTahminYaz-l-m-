// Backend API'ye tum istekler bu dosyadan gecer.
// Adres .env'deki VITE_API_BASE_URL'den okunur (Visual Studio'nun atadigi
// porta gore .env icinde guncellenmesi gerekebilir).

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5160/api';

async function get(path, params) {
  const url = new URL(BASE_URL.replace(/\/$/, '') + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  let res;
  try {
    res = await fetch(url.toString());
  } catch (err) {
    throw new Error(
      `API'ye ulasilamadi (${url.toString()}). Backend (Visual Studio / dotnet run) calisiyor mu ve .env'deki port dogru mu?`
    );
  }

  if (!res.ok) {
    throw new Error(`API hatasi: ${res.status} ${res.statusText} (${url.pathname})`);
  }
  return res.json();
}

export const api = {
  butceKalemleri: (params) => get('/ButceKalemleri', params),
  butceKalemi: (id) => get(`/ButceKalemleri/${id}`),
  gerceklesenDeger: (params) => get('/GerceklesenDeger', params),
  makroGostergeSon: () => get('/MakroGosterge/son'),
  makroGosterge: (params) => get('/MakroGosterge', params),
  tahminSonucu: (params) => get('/TahminSonucu', params),
  backtesting: () => get('/TahminSonucu/backtesting'),
  departmanlar: () => get('/Departman'),
  tahminModelleri: () => get('/TahminModeli'),
};

export { BASE_URL };
