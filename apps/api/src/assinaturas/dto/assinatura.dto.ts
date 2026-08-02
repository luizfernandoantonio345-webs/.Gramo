import { MetodoAssinatura, StatusAssinatura, TipoDocAssinatura } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** ADM 3 -- envio de um documento para assinatura. */
export class EnviarAssinaturaDto {
  @IsUUID('4')
  funcionarioId!: string;

  @IsEnum(TipoDocAssinatura)
  tipo!: TipoDocAssinatura;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titulo!: string;

  /** Competencia "YYYY-MM" (holerite). Opcional para avulsos. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'competencia deve ser YYYY-MM.' })
  competencia?: string;

  @IsString()
  arquivoBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mime?: string;

  @IsOptional()
  @IsBoolean()
  permiteDownloadAntesAssinatura?: boolean;
}

export class EnviarLoteDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => EnviarAssinaturaDto)
  itens!: EnviarAssinaturaDto[];
}

/** Tela 2 -- ato de assinar (re-autenticacao com senha). */
export class AssinarDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha!: string;

  @IsOptional()
  @IsEnum(MetodoAssinatura)
  metodo?: MetodoAssinatura;
}

export class RecusarDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}

export class FilaAssinaturaQuery {
  @IsOptional()
  @IsEnum(StatusAssinatura)
  status?: StatusAssinatura;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  competencia?: string;

  @IsOptional()
  @IsUUID('4')
  funcionarioId?: string;
}
