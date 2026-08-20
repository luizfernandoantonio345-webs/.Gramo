/**
 * Biometria de plataforma (Face ID / Touch ID / sensor de digitais) via WebAuthn.
 *
 * Modelo de segurança:
 *  - O WebAuthn cria uma credencial ligada ao biométrico do dispositivo; a chave
 *    privada nunca sai do hardware.
 *  - O refresh token é armazenado em localStorage, protegido pela origem (sandbox
 *    do browser). A biometria é o "cofre" que libera seu uso via UI.
 *  - Se o refresh token for revogado no servidor (ex.: protocolo de emergência),
 *    o login biométrico falha normalmente e o usuário refaz o login convencional.
 *  - Logout convencional NÃO apaga o refresh biométrico (por design), permitindo
 *    reentrada rápida. O usuário pode revogar manualmente via "Desativar biometria".
 */

const K_BIO_ENABLED = 'repp_bio_enabled';
const K_BIO_CREDENTIAL = 'repp_bio_credential';
const K_BIO_REFRESH = 'repp_bio_refresh';

/** Retorna true se o dispositivo tem autenticador de plataforma (Face ID / fingerprint). */
export async function suportaBiometria(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** true se a biometria já foi registrada neste dispositivo. */
export function biometriaAtiva(): boolean {
  return localStorage.getItem(K_BIO_ENABLED) === '1';
}

/**
 * Registra a credencial biométrica do dispositivo e armazena o refresh token.
 * Chama o autenticador de plataforma (Face ID / fingerprint) para confirmar.
 */
export async function registrarBiometria(cpf: string, refreshToken: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(cpf);

    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'REP-P Ponto', id: window.location.hostname },
        user: { id: userId, name: cpf, displayName: cpf },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!cred) return false;

    const idB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem(K_BIO_CREDENTIAL, idB64);
    localStorage.setItem(K_BIO_REFRESH, refreshToken);
    localStorage.setItem(K_BIO_ENABLED, '1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Autentica com o biométrico do dispositivo.
 * Retorna o refresh token armazenado se o biométrico for validado; null caso contrário.
 */
export async function autenticarBiometria(): Promise<string | null> {
  const idB64 = localStorage.getItem(K_BIO_CREDENTIAL);
  const rt = localStorage.getItem(K_BIO_REFRESH);
  if (!idB64 || !rt) return null;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credId = Uint8Array.from(atob(idB64), (c) => c.charCodeAt(0));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: credId, transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return assertion ? rt : null;
  } catch {
    return null;
  }
}

/** Atualiza o refresh token armazenado para a biometria (chamado após cada renovação). */
export function atualizarRefreshBiometria(novoRefresh: string): void {
  if (biometriaAtiva()) localStorage.setItem(K_BIO_REFRESH, novoRefresh);
}

/** Remove todos os dados biométricos deste dispositivo. */
export function desativarBiometria(): void {
  localStorage.removeItem(K_BIO_ENABLED);
  localStorage.removeItem(K_BIO_CREDENTIAL);
  localStorage.removeItem(K_BIO_REFRESH);
}
