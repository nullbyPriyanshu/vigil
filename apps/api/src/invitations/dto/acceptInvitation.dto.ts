import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsValidPassword } from 'src/auth/dto/password-rules';

// Everything is optional because there are three ways to accept:
//  - no account yet: send name + password (+ timezone) to create one
//  - have an account and logged in: send nothing
//  - have an account but not logged in: send currentPassword to prove it's
//    yours. This is the only way back in for someone who was removed from
//    their organization, because an account with no organization can't log in.
// The service checks that the right fields arrived for each case.
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
