import { IsUUID } from 'class-validator';

export class MoveApplicationDto {
  @IsUUID()
  stageId: string;
}