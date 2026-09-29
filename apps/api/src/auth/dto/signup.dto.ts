import {
  IsEmail,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from './normalize-email';
import { IsValidPassword } from './password-rules';

export class SignupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsValidPassword()
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  organizationName!: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
