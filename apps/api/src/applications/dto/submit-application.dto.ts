import { Transform } from 'class-transformer';
import { IsEmail, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SubmitApplicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsObject()
  answers: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  /** Honeypot: hidden in the page, so people leave it empty and bots fill it in. */
  @IsOptional()
  @IsString()
  website?: string;
}