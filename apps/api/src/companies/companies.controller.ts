import { Controller, Get, Post, Body } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { createCompanySchema, type CreateCompanyDto } from './dto/create-company.dto.js';
import { CurrentUser } from '@nestjs/authentication';
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) { }

  @Post()
  create(@CurrentUser('id') userId: string, @Body({ schema: createCompanySchema }) createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(userId, createCompanyDto);
  }

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.companiesService.listForUser(userId);
  }

}
