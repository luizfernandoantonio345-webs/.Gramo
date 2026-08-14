import { RegimeHoras, TipoFeriado } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CriarFilialDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve ter 14 digitos (sem mascara).' })
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;
}

export class CriarJornadaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @Matches(HHMM, { message: 'horaEntrada deve ser HH:MM (24h).' })
  horaEntrada!: string;

  @Matches(HHMM, { message: 'horaSaida deve ser HH:MM (24h).' })
  horaSaida!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  toleranciaMinutos?: number;

  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana!: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  cargaDiariaMinutos?: number;

  @IsOptional()
  @IsEnum(RegimeHoras)
  regimeHoras?: RegimeHoras;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  limiteExtraDiariaMin?: number;
}

export class AtualizarJornadaDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nome?: string;
  @IsOptional() @Matches(HHMM) horaEntrada?: string;
  @IsOptional() @Matches(HHMM) horaSaida?: string;
  @IsOptional() @IsInt() @Min(0) @Max(240) toleranciaMinutos?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[];
  @IsOptional() @IsInt() @Min(0) @Max(1440) cargaDiariaMinutos?: number;
  @IsOptional() @IsEnum(RegimeHoras) regimeHoras?: RegimeHoras;
  @IsOptional() @IsInt() @Min(0) @Max(480) limiteExtraDiariaMin?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class CriarFeriadoDto {
  @IsISO8601()
  data!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsEnum(TipoFeriado)
  tipo!: TipoFeriado;

  @IsOptional()
  @IsUUID('4')
  filialId?: string;
}
