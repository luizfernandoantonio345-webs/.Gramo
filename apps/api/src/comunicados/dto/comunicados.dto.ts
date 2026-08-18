import { PublicoComunicado } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarComunicadoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titulo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  mensagem!: string;

  @IsEnum(PublicoComunicado)
  publicoTipo!: PublicoComunicado;

  /** filialId, cargo ou funcionarioId conforme o publicoTipo (nulo para TODOS). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publicoValor?: string;

  /** Imagem base64 data-URL opcional (arte de DDS, banner, etc). Max ~500 KB. */
  @IsOptional()
  @IsString()
  @MaxLength(700000)
  imagem?: string;
}
