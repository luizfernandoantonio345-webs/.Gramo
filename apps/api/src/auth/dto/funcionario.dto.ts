import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class FuncionarioLoginDto {
  @IsString()
  @MaxLength(14)
  cpf!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha!: string;
}

export class PrimeiroAcessoDto {
  @IsString()
  @Length(8, 8)
  codigo!: string;

  @IsString()
  @MaxLength(14)
  cpf!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha!: string;

  /** Aceite do termo LGPD para biometria facial (obrigatorio). */
  @IsBoolean()
  aceiteTermos!: boolean;
}

export class RecuperarSenhaDto {
  @IsString()
  @MaxLength(14)
  cpf!: string;
}

export class RedefinirSenhaDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  novaSenha!: string;
}

/** Emissao de convite (RH cria o esqueleto do funcionario + codigo de acesso). */
export class CriarConviteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsString()
  @MaxLength(14)
  cpf!: string;

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
  @IsUUID('4')
  filialId?: string;

  @IsOptional()
  @IsUUID('4')
  jornadaId?: string;
}
