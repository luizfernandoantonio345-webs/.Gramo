import { TipoAusencia } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ---- ADM 10: Ferias e Afastamentos ----

export class SolicitarFeriasDto {
  @IsEnum(TipoAusencia)
  tipo!: TipoAusencia;

  @Matches(DATA, { message: 'dataInicio deve ser YYYY-MM-DD.' })
  dataInicio!: string;

  @Matches(DATA, { message: 'dataFim deve ser YYYY-MM-DD.' })
  dataFim!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class DecidirFeriasDto {
  @IsBoolean()
  aprovar!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoResposta?: string;
}

export class CalendarioQuery {
  @IsISO8601()
  de!: string;

  @IsISO8601()
  ate!: string;
}

// ---- ADM 11: Contestacao de ponto ----

export class AbrirContestacaoDto {
  @IsUUID('4')
  pontoId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}

export class ResponderContestacaoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  resposta!: string;
}
