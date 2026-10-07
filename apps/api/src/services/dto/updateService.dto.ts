import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MAX_AUTO_RESOLVE_MINUTES } from './createService.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateServiceDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Service name must be at least 2 characters' })
  @MaxLength(80, { message: 'Service name must be at most 80 characters' })
  name?: string;

  @ValidateIf((dto: UpdateServiceDto) => dto.description != null)
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: 'teamId must be a valid team id' })
  teamId?: string;

  @IsOptional()
  @IsUUID(undefined, {
    message: 'escalationPolicyId must be a valid policy id',
  })
  escalationPolicyId?: string;

  @ValidateIf((dto: UpdateServiceDto) => dto.autoResolveMinutes != null)
  @IsInt({ message: 'autoResolveMinutes must be a whole number of minutes' })
  @Min(1, { message: 'autoResolveMinutes must be at least 1' })
  @Max(MAX_AUTO_RESOLVE_MINUTES, {
    message: `autoResolveMinutes can be at most ${MAX_AUTO_RESOLVE_MINUTES} (one week)`,
  })
  autoResolveMinutes?: number | null;
}
