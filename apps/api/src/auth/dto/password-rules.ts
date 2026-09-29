import { applyDecorators } from '@nestjs/common';
import { IsString, IsStrongPassword, MaxLength } from 'class-validator';

export const IsValidPassword = () =>
  applyDecorators(
    IsString(),
    IsStrongPassword(
      {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      },
      {
        message:
          'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol',
      },
    ),
    MaxLength(72, { message: 'Password must be at most 72 characters' }),
  );
