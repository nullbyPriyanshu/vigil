import { IsEmail, IsIn } from 'class-validator';
import { NormalizeEmail } from 'src/auth/dto/normalize-email';
import { ASSIGNABLE_ROLES } from 'src/common/permissions';
import type { AssignableRole } from 'src/common/permissions';

export class CreateInvitationDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  // OWNER isn't in the list on purpose: ownership only moves through
  // "transfer ownership".
  @IsIn(ASSIGNABLE_ROLES, {
    message: 'Role must be one of ADMIN, RESPONDER or VIEWER',
  })
  role!: AssignableRole;
}
