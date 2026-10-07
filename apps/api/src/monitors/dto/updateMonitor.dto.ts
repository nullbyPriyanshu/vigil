import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateMonitorDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Monitor name must be at least 2 characters' })
  @MaxLength(80, { message: 'Monitor name must be at most 80 characters' })
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { message: 'Enter a full address, like https://example.com/health' },
  )
  @MaxLength(500, { message: 'The address must be at most 500 characters' })
  url?: string;

  @IsOptional()
  @IsIn([1, 5, 15], { message: 'Check every 1, 5 or 15 minutes' })
  intervalMinutes?: number;

  @IsOptional()
  @IsUUID('all', { message: 'Choose a service' })
  serviceId?: string;
}
