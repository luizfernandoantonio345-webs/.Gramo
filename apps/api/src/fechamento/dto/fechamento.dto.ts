import { IsString, IsUUID, Matches } from 'class-validator';

export class GerarFechamentoDto {
  @IsUUID('4')
  funcionarioId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'competencia deve ser "AAAA-MM".' })
  @IsString()
  competencia!: string;
}
