import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizeEmail } from 'src/auth/dto/normalize-email';

export class UpdateUserEmailDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;
}
