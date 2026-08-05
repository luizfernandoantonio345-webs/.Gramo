import { TipoMarcacao } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

/** Cadastro de um dispositivo de quiosque (admin RH). */
export class CriarDispositivoDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsUUID('4')
  filialId!: string;
}

/** Marcacao feita no quiosque: identifica o funcionario por CPF. */
export class KioskPontoDto {
  /** CPF com ou sem mascara; normalizado (so digitos) no servico. */
  @IsString()
  @Length(11, 14)
  cpf!: string;

  @IsUUID('4')
  uuidIdempotencia!: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  precisaoMetros?: number;

  @IsOptional()
  @IsString()
  fotoBase64?: string;

  @IsOptional()
  @IsEnum(TipoMarcacao)
  tipo?: TipoMarcacao;
}
