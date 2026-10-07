import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAlertDto {
  @IsString({ message: 'title is required' })
  @IsNotEmpty({ message: 'title is required' })
  @MaxLength(255, { message: 'title must be at most 255 characters' })
  title!: string;

  @IsOptional()
  @IsString({ message: 'dedup_key must be a string' })
  @MaxLength(255, { message: 'dedup_key must be at most 255 characters' })
  dedup_key?: string;

  @IsOptional()
  @IsIn(['critical', 'high', 'low'], {
    message: 'severity must be critical, high or low',
  })
  severity?: 'critical' | 'high' | 'low';

  @IsOptional()
  @IsIn(['triggered', 'resolved'], {
    message: 'status must be triggered or resolved',
  })
  status?: 'triggered' | 'resolved';

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(5000, { message: 'description must be at most 5000 characters' })
  description?: string;

  @IsOptional()
  @IsObject({ message: 'details must be a JSON object' })
  details?: Record<string, unknown>;
}
