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

export class CreateEscalationPolicyDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Policy name must be at least 2 characters' })
  @MaxLength(80, { message: 'Policy name must be at most 80 characters' })
  name!: string;

  // How many extra times to run through every step if nobody responds.
  @IsOptional()
  @IsInt({ message: 'repeatCount must be a whole number' })
  @Min(0, { message: 'repeatCount cannot be negative' })
  @Max(10, { message: 'repeatCount can be at most 10' })
  repeatCount?: number;

  // Only checked to be a list here. Each step is checked by parseSteps
  // (steps.validation.ts), which can say exactly which step is wrong.
  @IsArray({ message: 'steps must be a list' })
  steps!: unknown[];
}
