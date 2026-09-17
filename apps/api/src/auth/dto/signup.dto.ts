import {
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @IsStrongPassword()
  password!: string;

  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
