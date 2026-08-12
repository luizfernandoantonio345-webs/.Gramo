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

/** Ponto em edicao: centro + raio que o admin esta reposicionando no mapa. */
export interface PreviaRegap {
  lat: number;
  lng: number;
  raio: number;
}

interface Props {
  obras: ObraMapa[];
  /** Se informado, o mapa fica clicavel e devolve a coordenada clicada. */
  onSelecionar?: (lat: number, lng: number) => void;
  /** Circulo tracejado de previa do ponto sendo editado (nao persiste ainda). */
  previa?: PreviaRegap | null;
}

/**
 * Mapa das obras (REGAP). Cada area vira um CIRCULO na escala real do raio da
 * cerca geografica + um ponto no centro. Usa Leaflet + tiles do OpenStreetMap
 * (sem chave de API). Carregado sob demanda (default export -> React.lazy).
 *
 * O mapa e criado UMA vez; areas, previa e handler de clique sao atualizados em
 * efeitos separados para nao reconstruir tudo (e perder zoom/pan) a cada clique.
 */
export default function MapaObras({ obras, onSelecionar, previa }: Props) {
  const div = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const camadaAreas = useRef<L.LayerGroup | null>(null);
  const camadaPrevia = useRef<L.LayerGroup | null>(null);
  const viewFixada = useRef(false);
  // Handler mais recente sem re-attachar o listener a cada render.
  const onSelecionarRef = useRef(onSelecionar);
  onSelecionarRef.current = onSelecionar;

  // Cria o mapa uma vez.
  useEffect(() => {
    const el = div.current;
    if (!el) return;
    const mapa = L.map(el, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);
    camadaAreas.current = L.layerGroup().addTo(mapa);
    camadaPrevia.current = L.layerGroup().addTo(mapa);
    mapa.on('click', (e: L.LeafletMouseEvent) => {
      onSelecionarRef.current?.(e.latlng.lat, e.latlng.lng);
    });
    mapaRef.current = mapa;
    // O container as vezes so ganha tamanho apos o layout; recalcula para evitar
    // projecao invalida / mapa cinza.
    const t = setTimeout(() => mapa.invalidateSize(), 0);
    return () => {
      clearTimeout(t);
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Deixa o cursor de "mira" quando o mapa esta clicavel.
  useEffect(() => {
    const el = div.current;
    if (el) el.style.cursor = onSelecionar ? 'crosshair' : '';
  }, [onSelecionar]);

  // Redesenha os circulos das areas quando a lista muda.
  useEffect(() => {
    const mapa = mapaRef.current;
    const camada = camadaAreas.current;
    if (!mapa || !camada) return;
    camada.clearLayers();

    for (const o of obras) {
      const cor = o.ativo ? '#2563eb' : '#94a3b8';
      L.circle([o.lat, o.lng], {
        radius: o.raio,
        color: cor,
        fillColor: cor,
        fillOpacity: 0.15,
        weight: 2,
      })
        .bindPopup(`<strong>${o.nome}</strong><br/>raio ${o.raio} m`)
        .addTo(camada);
      L.circleMarker([o.lat, o.lng], {
        radius: 4,
        color: cor,
        fillColor: cor,
        fillOpacity: 1,
      }).addTo(camada);
    }

    // Fixa a VIEW so na primeira vez que ha coordenadas (nao "pula" ao editar).
    if (!viewFixada.current) {
      const pontos = obras.map((o) => L.latLng(o.lat, o.lng));
      const centro = pontos[0];
      if (pontos.length === 1 && centro) {
        mapa.setView(centro, 15);
        viewFixada.current = true;
      } else if (pontos.length > 1) {
        mapa.fitBounds(L.latLngBounds(pontos).pad(0.3));
        viewFixada.current = true;
      }
    }
  }, [obras]);

  // Desenha/atualiza o circulo de previa do ponto em edicao.
  useEffect(() => {
    const camada = camadaPrevia.current;
    if (!camada) return;
    camada.clearLayers();
    if (!previa) return;
    L.circle([previa.lat, previa.lng], {
      radius: previa.raio,
      color: '#16a34a',
      fillColor: '#16a34a',
      fillOpacity: 0.2,
      weight: 2,
      dashArray: '6 6',
    }).addTo(camada);
    L.circleMarker([previa.lat, previa.lng], {
      radius: 5,
      color: '#16a34a',
      fillColor: '#fff',
      fillOpacity: 1,
      weight: 2,
    }).addTo(camada);
  }, [previa]);

  if (obras.length === 0 && !previa) return null;
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
