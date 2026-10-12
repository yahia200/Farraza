import { ArrayMaxSize, IsArray } from 'class-validator';

export class SaveFormDto {
  @IsArray()
  @ArrayMaxSize(50)
  fields: unknown[];
}