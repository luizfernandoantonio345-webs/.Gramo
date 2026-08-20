import { IsString, MaxLength, MinLength } from 'class-validator';

export class TrocarSenhaObrigatorioDto {
  @IsString()
  trocaSenhaToken!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  novaSenha!: string;
}
