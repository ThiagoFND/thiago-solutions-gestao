import 'reflect-metadata';
import { describe,it,expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompanyDto,OwnerDto } from '../tenants/tenancy.dto.js';
import { normalizePhone,validPhone,normalizeEmail,safePassword } from './business-validation.js';
import { CreateProductDto } from '../products/dto/product.dto.js';
import { validateAttachment } from '../finance/attachments/attachment-validation.js';
import { csvCell } from '../finance/fiscal-sales.service.js';
const company={cnpj:'11222333000181',legalName:'Empresa Teste',tradeName:'Teste',corporateEmail:'test@example.com',phone:'11999999999'};
describe('business validation backend authority',()=>{
 it.each(['1133334444','11999999999','(11) 3333-4444','(11) 99999-9999'])('accepts phone %s',async phone=>{expect(validPhone(normalizePhone(phone))).toBe(true);expect(await validate(plainToInstance(CompanyDto,{...company,phone}))).toHaveLength(0);});
 it.each(['123','119999999999','119abc99999','+5511999999999',null,12345678901])('rejects phone %s',async phone=>{expect((await validate(plainToInstance(CompanyDto,{...company,phone}))).length).toBeGreaterThan(0);});
 it.each(['usuario@gmail.com','usuario@hotmail.com','usuario@outlook.com','usuario@empresa.com.br',' USUARIO @ Empresa.com.br '])('accepts email %s',async corporateEmail=>{const dto=plainToInstance(CompanyDto,{...company,corporateEmail});expect(dto.corporateEmail).toBe(normalizeEmail(corporateEmail));expect(await validate(dto)).toHaveLength(0);});
 it.each(['usuario@gmail','@gmail.com','user@','user@@gmail.com','user@-invalid.com','user@a..com'])('rejects email %s',async corporateEmail=>{expect((await validate(plainToInstance(CompanyDto,{...company,corporateEmail}))).length).toBeGreaterThan(0);});
 it('confirmation is checked in DTO independently from browser',async()=>{const dto=plainToInstance(OwnerDto,{name:'Pessoa',email:'p@empresa.com',password:'StrongUnique123!',passwordConfirmation:'Different123!'});const errors=await validate(dto);expect(errors.some(e=>Object.values(e.constraints??{}).includes('As senhas informadas não são iguais.'))).toBe(true);});
 it.each([' short','StrongUnique123! ',' StrongUnique123!','SenhaDemonstrativa123','ç'.repeat(40)])('rejects password boundary %s',v=>expect(safePassword(v)).toBe(false));
 it('unknown product fields, negative cents and missing origin are rejected',async()=>{const dto=plainToInstance(CreateProductDto,{name:'Coxinha',category:'Salgados',priceCents:-1,tenantId:'forged'});const errors=await validate(dto,{whitelist:true,forbidNonWhitelisted:true});expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['origin','categoryId','supplyMode','priceCents','tenantId']));});
 it.each(['=SUM(1,2)','+cmd','@formula','-formula'])('protects CSV formula %s',v=>expect(csvCell(v).startsWith('"\'')).toBe(true));
});
describe('attachment validation',()=>{
 it('accepts safe XML',async()=>{expect(await validateAttachment({originalname:'nota.xml',mimetype:'application/xml',buffer:Buffer.from('<?xml version="1.0"?><nfe><valor>10</valor></nfe>')})).toEqual({mime:'application/xml',extension:'xml'});});
 it.each(['<html><script>alert(1)</script></html>','<!DOCTYPE a [<!ENTITY e SYSTEM "file:///secret">]><a>&e;</a>','<a>'])('rejects unsafe/malformed XML',async xml=>{await expect(validateAttachment({originalname:'nota.xml',mimetype:'application/xml',buffer:Buffer.from(xml)})).rejects.toMatchObject({status:400});});
 it('rejects traversal, fake MIME and oversized file',async()=>{for(const originalname of ['../nota.xml','nota.exe'])await expect(validateAttachment({originalname,mimetype:'application/xml',buffer:Buffer.from('<a/>')})).rejects.toMatchObject({status:400});await expect(validateAttachment({originalname:'nota.pdf',mimetype:'application/pdf',buffer:Buffer.from('<script/>')})).rejects.toMatchObject({status:400});await expect(validateAttachment({originalname:'nota.pdf',mimetype:'application/pdf',buffer:Buffer.alloc(5*1024*1024+1)})).rejects.toMatchObject({status:413});});
});
