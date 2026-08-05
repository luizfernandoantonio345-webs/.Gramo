/**
 * Cliente HTTP minimo da API REP-P. Envia o subdominio da empresa via header
 * `X-Tenant-Subdominio` (em producao viria do proprio subdominio do host) e o
 * Bearer token quando ha sessao. Renova o access token automaticamente no 401
 * (rotacionando o refresh token) e restaura a sessao apos recarregar a pagina.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:3000/api/v1';

export type Contexto = 'funcionario' | 'admin' | 'super';

const K_ACCESS = 'repp_access_token';
const K_REFRESH = 'repp_refresh_token';
const K_CTX = 'repp_contexto';

const ROTA_REFRESH: Record<Contexto, string> = {
  funcionario: '/auth/funcionario/refresh',
  admin: '/auth/admin/refresh',
  super: '/super/auth/refresh',
};

/** Emitido quando a sessao expira e nao foi possivel renovar (App volta ao login). */
export const EVENTO_SESSAO_EXPIRADA = 'repp:sessao-expirada';

export interface ParTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// --- Sessao -----------------------------------------------------------------

export function definirSessao(t: ParTokens, contexto: Contexto): void {
  localStorage.setItem(K_ACCESS, t.accessToken);
  localStorage.setItem(K_REFRESH, t.refreshToken);
  localStorage.setItem(K_CTX, contexto);
}

export function limparSessao(): void {
  localStorage.removeItem(K_ACCESS);
  localStorage.removeItem(K_REFRESH);
  localStorage.removeItem(K_CTX);
}

/** Contexto salvo se ha sessao (para restaurar apos reload); senao null. */
export function sessaoAtual(): Contexto | null {
  const acc = localStorage.getItem(K_ACCESS);
  const ctx = localStorage.getItem(K_CTX) as Contexto | null;
  return acc && ctx ? ctx : null;
}

function accessToken(): string | null {
  return localStorage.getItem(K_ACCESS);
}

function subdominioAtual(): string {
  const host = window.location.hostname;
  const ehIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const ehTunnel = host.endsWith('.devtunnels.ms') || host.endsWith('.githubpreview.dev');
  // So extrai subdominio de dominios "reais"; IP/localhost/tunnel usam o tenant fixo.
  if (!ehIp && !ehTunnel && host !== 'localhost') {
    const partes = host.split('.');
    if (partes.length >= 3 && partes[0] && partes[0] !== 'www') return partes[0];
  }
  return (import.meta.env.VITE_TENANT as string) ?? 'piloto';
}

function headers(comAuth: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Subdominio': subdominioAtual(),
  };
  const t = accessToken();
  if (comAuth && t) h.Authorization = `Bearer ${t}`;
  return h;
}

// --- Renovacao automatica (deduplicada) -------------------------------------

let renovando: Promise<boolean> | null = null;

async function renovarSessao(): Promise<boolean> {
  const rt = localStorage.getItem(K_REFRESH);
  const ctx = localStorage.getItem(K_CTX) as Contexto | null;
  if (!rt || !ctx) return false;
  try {
    const resp = await fetch(`${BASE}${ROTA_REFRESH[ctx]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Subdominio': subdominioAtual() },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!resp.ok) return false;
    definirSessao((await resp.json()) as ParTokens, ctx);
    return true;
  } catch {
    return false;
  }
}

/** fetch com Bearer; no 401 tenta renovar UMA vez e refaz a requisicao. */
async function requisitar(path: string, init: RequestInit, comAuth: boolean): Promise<Response> {
  let resp = await fetch(`${BASE}${path}`, { ...init, headers: headers(comAuth) });
  if (resp.status === 401 && comAuth && localStorage.getItem(K_REFRESH)) {
    renovando = renovando ?? renovarSessao();
    const ok = await renovando;
    renovando = null;
    if (ok) {
      resp = await fetch(`${BASE}${path}`, { ...init, headers: headers(comAuth) });
    } else {
      limparSessao();
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    }
  }
  return resp;
}

async function tratar<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const texto = await resp.text();
    let msg = texto;
    try {
      const j = JSON.parse(texto) as { message?: string | string[] };
      msg = Array.isArray(j.message) ? j.message.join(' ') : (j.message ?? texto);
    } catch {
      /* corpo nao-JSON */
    }
    throw new ApiError(resp.status, msg || `Erro ${resp.status}`);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown, comAuth = false): Promise<T> {
  return tratar<T>(await requisitar(path, { method: 'POST', body: JSON.stringify(body) }, comAuth));
}

export async function apiGet<T>(path: string): Promise<T> {
  return tratar<T>(await requisitar(path, { method: 'GET' }, true));
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return tratar<T>(await requisitar(path, { method: 'PATCH', body: JSON.stringify(body) }, true));
}

// --- Quiosque (autenticacao por token de dispositivo, sem JWT) --------------

const K_KIOSK = 'repp_kiosk_token';

export function definirTokenKiosk(token: string): void {
  localStorage.setItem(K_KIOSK, token.trim());
}
export function tokenKioskAtual(): string | null {
  return localStorage.getItem(K_KIOSK);
}
export function limparTokenKiosk(): void {
  localStorage.removeItem(K_KIOSK);
}

/** POST no quiosque: envia o token do dispositivo (X-Kiosk-Token), sem Bearer. */
export async function kioskPost<T>(path: string, body: unknown): Promise<T> {
  const token = tokenKioskAtual();
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Subdominio': subdominioAtual(),
      ...(token ? { 'X-Kiosk-Token': token } : {}),
    },
    body: JSON.stringify(body),
  });
  return tratar<T>(resp);
}

/** Le um File como data URL (base64) para upload. */
export function lerArquivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
