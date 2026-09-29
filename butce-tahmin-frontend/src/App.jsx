import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import KalemListesi from './pages/KalemListesi.jsx';
import KalemDetay from './pages/KalemDetay.jsx';
import TahminSonuc from './pages/TahminSonuc.jsx';
import MakroGosterge from './pages/MakroGosterge.jsx';
import SenaryoKarsilastirma from './pages/SenaryoKarsilastirma.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kalemler" element={<KalemListesi />} />
        <Route path="/kalemler/:id" element={<KalemDetay />} />
        <Route path="/tahmin" element={<TahminSonuc />} />
        <Route path="/makro" element={<MakroGosterge />} />
        <Route path="/senaryo" element={<SenaryoKarsilastirma />} />
      </Routes>
    </Layout>
  );
}
