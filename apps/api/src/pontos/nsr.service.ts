import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaTxClient } from '../prisma/prisma.service';

/**
 * Atribuicao do NSR (Numero Sequencial de Registro) por estabelecimento (filial),
 * SEM furos. E sempre server-side (a Portaria 671 exige sequencia do REP; devices
 * offline nao conseguem coordenar).
 *
 * Atomicidade: um unico INSERT ... ON CONFLICT incrementa e retorna o novo NSR
 * na mesma instrucao -- duas marcacoes concorrentes na mesma filial NUNCA pegam
 * o mesmo numero (o proprio banco serializa no conflito de chave unica).
 */
@Injectable()
export class NsrService {
  async proximo(tx: PrismaTxClient, empresaId: string, filialId: string): Promise<bigint> {
    const linhas = await tx.$queryRaw<Array<{ ultimo_nsr: bigint }>>(Prisma.sql`
      INSERT INTO contadores_nsr (id, empresa_id, filial_id, ultimo_nsr)
      VALUES (gen_random_uuid(), ${empresaId}::uuid, ${filialId}::uuid, 1)
      ON CONFLICT (filial_id)
        DO UPDATE SET ultimo_nsr = contadores_nsr.ultimo_nsr + 1
      RETURNING ultimo_nsr
    `);
    return linhas[0]!.ultimo_nsr;
  }
}
