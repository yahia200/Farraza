import { IsEmail, IsIn } from 'class-validator';

export class AddMemberDto {
  @IsEmail()
  email: string;

  @IsIn(['admin', 'recruiter', 'interviewer'])
  role: 'admin' | 'recruiter' | 'interviewer';
}