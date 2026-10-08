import { IsIn } from 'class-validator';

export class UpdateMemberDto {
  @IsIn(['admin', 'recruiter', 'interviewer'])
  role: 'admin' | 'recruiter' | 'interviewer';
}