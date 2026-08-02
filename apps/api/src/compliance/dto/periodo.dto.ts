import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

/** Periodo de referencia para exportacoes/relatorios legais. */
export class PeriodoDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  /**
   * Estabelecimento (filial). O AFD/AEJ e POR ESTABELECIMENTO (o NSR e sequencial
   * por filial). Opcional apenas quando a empresa tem uma unica filial.
   */
  @IsOptional()
  @IsUUID('4')
  filialId?: string;
}
