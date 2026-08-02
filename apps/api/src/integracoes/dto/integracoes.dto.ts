import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GerarChaveDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  escopo?: string;
}

export class AtualizarIntegracaoDto {
  @IsBoolean()
  ativo!: boolean;

  /** Config especifica (credenciais/endpoints). Guardada como JSON. */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
