import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Key name must be at least 2 characters' })
  @MaxLength(80, { message: 'Key name must be at most 80 characters' })
  name: string;
}
