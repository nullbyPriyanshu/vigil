import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'confirmName is required' })
  confirmName!: string;
}
