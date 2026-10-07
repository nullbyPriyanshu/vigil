import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsValidPassword } from 'src/auth/dto/password-rules';

export class AcceptInvitationDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name?: string;

  @IsOptional()
  @IsValidPassword()
  password?: string;

  @IsOptional()
  @IsTimeZone({ message: 'Timezone must be a valid IANA timezone' })
  timezone?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;
}
