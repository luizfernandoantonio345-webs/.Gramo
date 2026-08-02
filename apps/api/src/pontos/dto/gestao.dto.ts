import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Decisao do RH sobre uma excecao (aprovar/recusar) -- motivo obrigatorio. */
export class DecidirExcecaoDto {
  @IsBoolean()
  aprovar!: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivoResposta!: string;
}

/** Ajuste manual de um ponto: NUNCA sobrescreve o original (cria registro). */
export class AjusteManualDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;

  /** Novo horario proposto (ISO), se aplicavel. */
  @IsOptional()
  @IsISO8601()
  novoRegistradoEm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

export class EspelhoQueryDto {
  @IsUUID('4')
  funcionarioId!: string;

  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;
}

export class CriarRegapDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsLatitude()
  latitudeCentro!: number;

  @IsLongitude()
  longitudeCentro!: number;

  @IsInt()
  @Min(10)
  @Max(100000)
  raioMetros!: number;

  @IsOptional()
  @IsUUID('4')
  filialId?: string;
}

export class AtualizarRegapDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsLatitude()
  latitudeCentro?: number;

  @IsOptional()
  @IsLongitude()
  longitudeCentro?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  raioMetros?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
