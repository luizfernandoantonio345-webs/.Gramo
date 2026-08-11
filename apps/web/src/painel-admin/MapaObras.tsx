import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface ObraMapa {
  nome: string;
  lat: number;
  lng: number;
  raio: number;
  ativo: boolean;
}

/**
 * Mapa das obras (REGAP). Cada area vira um CIRCULO na escala real do raio da
 * cerca geografica + um ponto no centro. Usa Leaflet + tiles do OpenStreetMap
 * (sem chave de API). Carregado sob demanda (default export -> React.lazy).
 */
export default function MapaObras({ obras }: { obras: ObraMapa[] }) {
  const div = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = div.current;
    if (!el || obras.length === 0) return;
    const mapa = L.map(el, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);

    // Estabelece a VIEW a partir das COORDENADAS (nao do getBounds() dos
    // circulos, que exige a projecao do mapa ja pronta -- fazia o app quebrar
    // com "layerPointToLatLng of undefined"). latLngBounds e calculo puro.
    const pontos = obras.map((o) => L.latLng(o.lat, o.lng));
    if (pontos.length === 1) {
      mapa.setView(pontos[0], 14);
    } else {
      mapa.fitBounds(L.latLngBounds(pontos).pad(0.3));
    }

    for (const o of obras) {
      const cor = o.ativo ? '#2563eb' : '#94a3b8';
      L.circle([o.lat, o.lng], {
        radius: o.raio,
        color: cor,
        fillColor: cor,
        fillOpacity: 0.15,
        weight: 2,
      })
        .addTo(mapa)
        .bindPopup(`<strong>${o.nome}</strong><br/>raio ${o.raio} m`);
      L.circleMarker([o.lat, o.lng], {
        radius: 4,
        color: cor,
        fillColor: cor,
        fillOpacity: 1,
      }).addTo(mapa);
    }

    // O container as vezes so ganha tamanho apos o layout; recalcula para evitar
    // projecao invalida / mapa cinza.
    const t = setTimeout(() => mapa.invalidateSize(), 0);

    return () => {
      clearTimeout(t);
      mapa.remove();
    };
  }, [obras]);

  if (obras.length === 0) return null;
  return (
    <div
      ref={div}
      role="img"
      aria-label="Mapa das obras com as áreas de registro (REGAP)"
      style={{
        height: 320,
        width: '100%',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}
    />
  );
}
