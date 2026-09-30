import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidPassword } from 'src/auth/dto/password-rules';

export class UpdateUserPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @IsValidPassword()
  newPassword!: string;
}
