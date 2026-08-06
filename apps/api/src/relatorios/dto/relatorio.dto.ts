import { IsISO8601, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** Periodo do relatorio (espelho). Competencia opcional (YYYY-MM) p/ os ajustes. */
export class EspelhoPdfDto {
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'competencia deve ser YYYY-MM' })
  competencia?: string;
}

/** Fechamento gerencial por obra (filial) numa competencia (YYYY-MM). */
export class FechamentoObraDto {
  @IsUUID()
  filialId!: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'competencia deve ser YYYY-MM' })
  competencia!: string;
}
