import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Same fields as creating, all optional. If `steps` is sent, it replaces
// every existing step.
export class UpdateEscalationPolicyDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Policy name must be at least 2 characters' })
  @MaxLength(80, { message: 'Policy name must be at most 80 characters' })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'repeatCount must be a whole number' })
  @Min(0, { message: 'repeatCount cannot be negative' })
  @Max(10, { message: 'repeatCount can be at most 10' })
  repeatCount?: number;

  @IsOptional()
  @IsArray({ message: 'steps must be a list' })
  steps?: unknown[];
}
