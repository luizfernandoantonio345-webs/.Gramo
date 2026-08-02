import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Cadastro self-service de uma nova empresa (rota publica /publico/onboarding). */
export class OnboardingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  razaoSocial!: string;

  @Matches(/^\d{14}$/, { message: 'cnpj deve ter 14 digitos (sem mascara).' })
  cnpj!: string;

  /** Subdominio do tenant: minusculas, numeros e hifen; 3-40 chars. */
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, {
    message: 'subdominio invalido (minusculas/numeros/hifen, 3-40 chars).',
  })
  subdominio!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  adminNome!: string;

  @IsEmail()
  adminEmail!: string;

  /** Validada pela politica de senha no servico. */
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  adminSenha!: string;
}
