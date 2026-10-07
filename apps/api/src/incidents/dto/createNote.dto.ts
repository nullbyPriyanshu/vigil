import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Message is required' })
  @IsNotEmpty({ message: "Message can't be empty" })
  @MaxLength(2000, { message: 'Message must be at most 2000 characters' })
  message!: string;
}
