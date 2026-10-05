import { IsIn } from 'class-validator';
import { ASSIGNABLE_ROLES } from 'src/common/permissions';
import type { AssignableRole } from 'src/common/permissions';

export class UpdateMemberRoleDto {
  @IsIn(ASSIGNABLE_ROLES, {
    message: 'Role must be one of ADMIN, RESPONDER or VIEWER',
  })
  role!: AssignableRole;
}
