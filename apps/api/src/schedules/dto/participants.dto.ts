import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AddParticipantDto {
  @IsUUID(undefined, { message: 'userId must be a valid user id' })
  userId!: string;
}

export class ReorderParticipantsDto {
  @IsArray()
  @ArrayUnique({ message: 'userIds must not repeat a user' })
  @IsUUID(undefined, { each: true, message: 'userIds must be user ids' })
  userIds!: string[];
}
