import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveIncidentDto {
  // What fixed it. Optional; saved as a comment on the timeline.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000, { message: 'Note must be at most 2000 characters' })
  note?: string;
}
