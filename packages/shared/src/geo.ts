/**
 * Geolocalizacao e avaliacao de REGAP (area geografica autorizada).
 * Funcoes puras -- usadas no backend (autoridade) e no front (anel em tempo real).
 */

export interface AreaRegap {
  id: string;
  latitude: number;
  longitude: number;
  raioMetros: number;
}

const RAIO_TERRA_METROS = 6_371_000;

function grausParaRad(g: number): number {
  return (g * Math.PI) / 180;
}

/** Distancia em metros entre dois pontos (formula de Haversine). */
export function distanciaHaversineMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = grausParaRad(lat2 - lat1);
  const dLon = grausParaRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(grausParaRad(lat1)) * Math.cos(grausParaRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RAIO_TERRA_METROS * c;
}

export interface ResultadoRegap {
  dentro: boolean;
  /** REGAP mais proxima que contem o ponto (se dentro), ou a mais proxima. */
  regapId: string | null;
  distanciaMetros: number | null;
}

/**
 * Avalia se uma coordenada esta dentro de alguma REGAP vinculada ao funcionario.
 * Sem coordenada (GPS indisponivel) -> considera FORA (pendente), nunca bloqueia.
 */
export function avaliarRegap(
  latitude: number | null,
  longitude: number | null,
  regaps: AreaRegap[],
): ResultadoRegap {
  if (latitude === null || longitude === null || regaps.length === 0) {
    return { dentro: false, regapId: null, distanciaMetros: null };
  }
  let melhor: ResultadoRegap = { dentro: false, regapId: null, distanciaMetros: Infinity };
  for (const r of regaps) {
    const d = distanciaHaversineMetros(latitude, longitude, r.latitude, r.longitude);
    const dentro = d <= r.raioMetros;
    if (dentro) {
      return { dentro: true, regapId: r.id, distanciaMetros: d };
    }
    if (d < (melhor.distanciaMetros ?? Infinity)) {
      melhor = { dentro: false, regapId: r.id, distanciaMetros: d };
    }
  }
  return melhor;
}
