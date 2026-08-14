import { TipoAjusteBanco } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegistrarAjusteDto {
  @Matches(/^[0-9a-f-]{36}$/i, { message: 'funcionarioId invalido.' })
  funcionarioId!: string;

  /** Positivo credita, negativo debita. */
  @IsInt()
  minutos!: number;

  @IsEnum(TipoAjusteBanco)
  tipo!: TipoAjusteBanco;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo!: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'competencia deve ser "AAAA-MM".' })
  competencia?: string;
}
