import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Filtros da trilha de auditoria (ADM 6). */
export class AuditoriaQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  acao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entidade?: string;

  @IsOptional()
  @IsISO8601()
  de?: string;

  @IsOptional()
  @IsISO8601()
  ate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
