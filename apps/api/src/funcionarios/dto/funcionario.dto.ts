import { StatusDocumento, StatusFuncionario, TipoDocumento } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// ---- ADM 2: gestao de funcionarios ----

export class CriarFuncionarioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsString()
  @MaxLength(14)
  cpf!: string;

  /** NIS/PIS/PASEP (11 digitos). Identificador do empregado no AFD (Portaria 671 Tipo 7). */
  @IsOptional()
  @IsString()
  @MaxLength(11)
  pis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargo?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salarioBase?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jornadaContratual?: string;

  @IsOptional()
  @IsUUID('4')
  jornadaId?: string;

  @IsOptional()
  @IsUUID('4')
  filialId?: string;
}

export class AtualizarFuncionarioDto {
  /** NIS/PIS/PASEP (11 digitos). Identificador do empregado no AFD (Portaria 671 Tipo 7). */
  @IsOptional()
  @IsString()
  @MaxLength(11)
  pis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargo?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salarioBase?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jornadaContratual?: string;

  @IsOptional()
  @IsUUID('4')
  jornadaId?: string;

  @IsOptional()
  @IsUUID('4')
  filialId?: string;

  @IsOptional()
  @IsEnum(StatusFuncionario)
  status?: StatusFuncionario;
}

export class ListarFuncionariosQuery {
  @IsOptional()
  @IsEnum(StatusFuncionario)
  status?: StatusFuncionario;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;
}

export class DecidirDocumentoDto {
  @IsBoolean()
  aprovar!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ImportarCsvDto {
  /** Conteudo do CSV (cabecalho: nome,cpf,cargo,jornada). */
  @IsString()
  conteudo!: string;
}

// ---- Tela 4: documentos (funcionario) ----

export class EnviarDocumentoDto {
  @IsEnum(TipoDocumento)
  tipo!: TipoDocumento;

  /** Arquivo em base64 ou data URL (PDF/JPG/PNG, ate 10MB). */
  @IsString()
  arquivoBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeArquivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mime?: string;

  @IsOptional()
  @IsISO8601()
  dataValidade?: string;
}

/** Filtro do status efetivo de documento (uso interno de resposta). */
export type StatusDocumentoEfetivo = StatusDocumento;
