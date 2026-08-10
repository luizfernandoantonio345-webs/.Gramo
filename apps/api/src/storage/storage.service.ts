import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { cifrarBuffer, decifrarBuffer } from '../common/crypto/aes';

/** Teto central de tamanho (defesa em profundidade contra upload gigante/DoS). */
const MAX_ARQUIVO_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Driver de armazenamento: recebe/entrega SEMPRE bytes ja cifrados (a cifragem
 * AES-256 vive no StorageService). Assim trocar local <-> S3/R2 nao muda a
 * garantia LGPD (biometria/documento nunca em claro no repouso).
 */
interface StorageDriver {
  gravar(ref: string, cifrado: Buffer): Promise<void>;
  ler(ref: string): Promise<Buffer>;
}

/** Driver local: filesystem (piloto/dev). Ref = caminho relativo opaco. */
class LocalDriver implements StorageDriver {
  private readonly base = resolve(process.env.STORAGE_LOCAL_PATH ?? './storage');
  async gravar(ref: string, cifrado: Buffer): Promise<void> {
    const caminho = join(this.base, ref);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, cifrado);
  }
  async ler(ref: string): Promise<Buffer> {
    return readFile(join(this.base, ref));
  }
}

/**
 * Driver S3-compativel (Cloudflare R2 / AWS S3). Ativa com STORAGE_DRIVER=s3 e
 * as variaveis STORAGE_S3_*. Requer `npm i @aws-sdk/client-s3` (import tardio
 * para nao pesar quando o driver local esta em uso).
 */
class S3Driver implements StorageDriver {
  private clientePromise?: Promise<{
    client: unknown;
    bucket: string;
    sdk: typeof import('@aws-sdk/client-s3');
  }>;

  private async conectar() {
    if (!this.clientePromise) {
      this.clientePromise = (async () => {
        const sdk = await import('@aws-sdk/client-s3');
        const bucket = req('STORAGE_S3_BUCKET');
        const client = new sdk.S3Client({
          region: process.env.STORAGE_S3_REGION ?? 'auto',
          endpoint: req('STORAGE_S3_ENDPOINT'), // R2: https://<accountid>.r2.cloudflarestorage.com
          credentials: {
            accessKeyId: req('STORAGE_S3_KEY'),
            secretAccessKey: req('STORAGE_S3_SECRET'),
          },
        });
        return { client, bucket, sdk };
      })();
    }
    return this.clientePromise;
  }

  async gravar(ref: string, cifrado: Buffer): Promise<void> {
    const { client, bucket, sdk } = await this.conectar();
    await (client as InstanceType<typeof sdk.S3Client>).send(
      new sdk.PutObjectCommand({ Bucket: bucket, Key: ref, Body: cifrado }),
    );
  }
  async ler(ref: string): Promise<Buffer> {
    const { client, bucket, sdk } = await this.conectar();
    const out = await (client as InstanceType<typeof sdk.S3Client>).send(
      new sdk.GetObjectCommand({ Bucket: bucket, Key: ref }),
    );
    const chunks: Buffer[] = [];
    for await (const c of out.Body as AsyncIterable<Buffer>) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
}

function req(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Variavel ${nome} obrigatoria para STORAGE_DRIVER=s3.`);
  return v;
}

/**
 * Armazenamento de arquivos sensiveis (fotos, documentos, exportacoes). Cifra o
 * blob em repouso (AES-256-GCM) e delega o put/get ao driver escolhido por
 * STORAGE_DRIVER (local | s3). A referencia e um caminho opaco; nunca expomos o
 * backend ao cliente.
 */
@Injectable()
export class StorageService {
  private readonly driver: StorageDriver =
    (process.env.STORAGE_DRIVER ?? 'local').toLowerCase() === 's3'
      ? new S3Driver()
      : new LocalDriver();

  /** Salva uma imagem (base64 ou data URL) cifrada e devolve a referencia. */
  salvarImagem(base64OuDataUrl: string, prefixo = 'captura'): Promise<string> {
    return this.salvarArquivo(base64OuDataUrl, prefixo);
  }

  /** Salva qualquer arquivo (base64/data URL) cifrado (AES-256) e devolve a ref. */
  async salvarArquivo(base64OuDataUrl: string, prefixo = 'arquivo'): Promise<string> {
    const base64 = base64OuDataUrl.includes(',')
      ? base64OuDataUrl.slice(base64OuDataUrl.indexOf(',') + 1)
      : base64OuDataUrl;
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_ARQUIVO_BYTES) {
      throw new PayloadTooLargeException('Arquivo excede o tamanho maximo permitido.');
    }
    const ref = `${prefixo}/${new Date().getFullYear()}/${randomUUID()}.enc`;
    await this.driver.gravar(ref, cifrarBuffer(buffer));
    return ref;
  }

  /** Le e decifra um arquivo pela referencia (uso administrativo/auditoria). */
  async lerImagem(ref: string): Promise<Buffer> {
    return decifrarBuffer(await this.driver.ler(ref));
  }
}
