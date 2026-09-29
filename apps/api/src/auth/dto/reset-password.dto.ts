import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidPassword } from './password-rules';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsValidPassword()
  password!: string;
}
