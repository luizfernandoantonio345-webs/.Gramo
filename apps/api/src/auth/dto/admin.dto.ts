import { PapelAdmin } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha!: string;
}

export class Desafio2faDto {
  @IsString()
  desafioToken!: string;
}

export class Verificar2faDto {
  @IsString()
  desafioToken!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  codigo!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class CriarAdminDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senhaProvisoria!: string;

  @IsEnum(PapelAdmin)
  papel!: PapelAdmin;

  /** Filiais sob gestao (obrigatorio na pratica para Gestor de Filial). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  filialIds?: string[];
}
