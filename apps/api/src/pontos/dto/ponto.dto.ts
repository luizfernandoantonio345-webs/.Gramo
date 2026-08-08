import { TipoMarcacao } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Marcacao online (hora oficial = servidor). */
export class RegistrarPontoDto {
  /** UUID gerado no client -- idempotencia ponta a ponta. */
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

  /** Foto da captura (base64 ou data URL). Guardada cifrada como evidencia. */
  @IsOptional()
  @IsString()
  @MaxLength(3_500_000) // ~2,5 MB de imagem (selfie); evita upload gigante (DoS)
  fotoBase64?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificativa?: string;

  /** Opcional: se ausente, o servidor deduz pela sequencia do dia. */
  @IsOptional()
  @IsEnum(TipoMarcacao)
  tipo?: TipoMarcacao;

  /** Reconhecimento facial 1:1 (feito no dispositivo): true=confere, false=nao. */
  @IsOptional()
  @IsBoolean()
  identidadeConfere?: boolean;
}

/** Item da fila offline (hora = do dispositivo, marcada como tal). */
export class SyncItemDto {
  @IsUUID('4')
  uuidIdempotencia!: string;

  @IsEnum(TipoMarcacao)
  tipo!: TipoMarcacao;

  @IsISO8601()
  capturadoEm!: string;

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
  @MaxLength(3_500_000) // ~2,5 MB de imagem (selfie); evita upload gigante (DoS)
  fotoBase64?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificativa?: string;

  @IsOptional()
  @IsBoolean()
  identidadeConfere?: boolean;
}

/** Upload da foto de referencia (selfie) do proprio funcionario, p/ matching facial. */
export class UploadReferenciaDto {
  @IsString()
  @MaxLength(3_500_000) // ~2,5 MB (selfie de referencia)
  fotoBase64!: string;
}

/** Consentimento LGPD de biometria facial (true=autoriza / false=revoga). */
export class ConsentimentoBiometriaDto {
  @IsBoolean()
  concedido!: boolean;
}

export class SyncPontosDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  registros!: SyncItemDto[];
}

/** Consulta do status de REGAP em tempo real (anel de presenca). Vem por query. */
export class RegapStatusDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}
