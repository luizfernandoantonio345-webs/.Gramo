/**
 * Reconhecimento facial 1:1 no NAVEGADOR (offline). Compara o rosto capturado
 * na batida com a foto de referencia aprovada pelo RH. A biometria e processada
 * no dispositivo; so o resultado (confere / distancia) acompanha o ponto.
 *
 * A lib face-api (+TensorFlow) e PESADA (~1,4 MB), entao e carregada SOB DEMANDA
 * (import dinamico) -- so entra na rede quando o funcionario liga a camera, sem
 * pesar no bundle principal (login/admin).
 *
 * Distancia euclidiana entre descritores (vetor de 128 floats): quanto menor,
 * mais parecido. Limiar 0.5 (o padrao da lib e ~0.6; usamos mais rigido).
 */
const LIMIAR = 0.5;
const URL_MODELOS = '/models';

type FaceApi = typeof import('@vladmandic/face-api');
let libPromise: Promise<FaceApi> | null = null;
let modelosPromise: Promise<void> | null = null;

async function lib(): Promise<FaceApi> {
  libPromise ??= import('@vladmandic/face-api');
  return libPromise;
}

/** Carrega a lib + os modelos (detector + landmarks + reconhecimento) uma unica vez. */
export function carregarModelosRosto(): Promise<void> {
  modelosPromise ??= (async () => {
    const faceapi = await lib();
    await faceapi.nets.tinyFaceDetector.loadFromUri(URL_MODELOS);
    await faceapi.nets.faceLandmark68Net.loadFromUri(URL_MODELOS);
    await faceapi.nets.faceRecognitionNet.loadFromUri(URL_MODELOS);
  })();
  return modelosPromise;
}

/** Extrai o descritor facial (128 floats) de um video/imagem; null se nao achar rosto. */
export async function descritorFacial(
  el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<Float32Array | null> {
  await carregarModelosRosto();
  const faceapi = await lib();
  const det = await faceapi
    .detectSingleFace(
      el,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det?.descriptor ?? null;
}

/** Compara dois descritores (euclidiana); confere = mesma pessoa (distancia < limiar). */
export function compararRostos(
  a: Float32Array,
  b: Float32Array,
): { confere: boolean; distancia: number } {
  let soma = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    soma += d * d;
  }
  const distancia = Math.sqrt(soma);
  return { confere: distancia < LIMIAR, distancia };
}

/** Carrega uma <img> a partir de um data URL / base64 (foto de referencia). */
export function imagemDeDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem de referencia.'));
    img.src = dataUrl;
  });
}
