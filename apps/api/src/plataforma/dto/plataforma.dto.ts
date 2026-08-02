import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ---- Auth do Super Admin ----

export class SuperLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha!: string;
}

export class SuperDesafio2faDto {
  @IsString()
  desafioToken!: string;
}

export class SuperVerificar2faDto {
  @IsString()
  desafioToken!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  codigo!: string;
}

export class SuperRefreshDto {
  @IsString()
  refreshToken!: string;
}

// ---- Gestao de plataforma ----

export class CriarEmpresaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  razaoSocial!: string;

  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve ter 14 digitos.' })
  cnpj!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{2,40}$/, { message: 'subdominio invalido (a-z, 0-9, hifen).' })
  subdominio!: string;

  @IsOptional()
  @IsUUID('4')
  planoId?: string;
}

export class CriarPlanoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome!: string;

  @IsInt()
  @Min(0)
  precoMensalCentavos!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limiteFuncionarios?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limiteArmazenamentoMb?: number;
}

export class GerarFaturaDto {
  @IsUUID('4')
  empresaId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'competencia deve ser YYYY-MM.' })
  competencia!: string;

  @IsInt()
  @Min(0)
  valorCentavos!: number;

  @IsISO8601()
  vencimento!: string;
}
