import { IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  @IsUUID(undefined, { message: 'userId must be a valid user id' })
  userId!: string;
}
