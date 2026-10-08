import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
}