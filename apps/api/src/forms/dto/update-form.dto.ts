import { PartialType } from '@nestjs/mapped-types';
import { CreateFormDto } from './create-form.dto.js';

export class UpdateFormDto extends PartialType(CreateFormDto) {}
