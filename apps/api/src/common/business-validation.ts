import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength, registerDecorator, ValidationArguments } from 'class-validator';
export const normalizeEmail = (v: unknown) => typeof v === 'string' ? v.replace(/\s/g, '').toLowerCase() : v;
export const normalizePhone = (v: unknown) => typeof v === 'string' && /^[\d ().-]+$/.test(v) ? v.replace(/\D/g, '') : v;
export const validPhone = (v: unknown) => typeof v === 'string' && /^\d{10,11}$/.test(v);
export const safePassword = (v: unknown) => typeof v === 'string' && v.length >= 12 && v.length <= 72 && Buffer.byteLength(v, 'utf8') <= 72 && v === v.trim() && !/^(?:admin|password|senha|demonstracao|demo|123456|qwerty)/i.test(v);
export function Rule(name: string, validate: (value: any, args: ValidationArguments) => boolean, message: string): PropertyDecorator {
  return (target, property) => registerDecorator({ name, target: target.constructor, propertyName: String(property), options: { message }, validator: { validate } });
}
export const EmailField = () => applyDecorators(Transform(({value}) => normalizeEmail(value)), IsEmail({require_tld:true}, {message:'Informe um e-mail válido, como usuario@empresa.com.br.'}), MaxLength(254));
export const PhoneField = () => applyDecorators(Transform(({value}) => normalizePhone(value)), Rule('phone', validPhone, 'Informe o DDD e um telefone válido com 10 ou 11 dígitos'));
export const PasswordField = () => Rule('safePassword', safePassword, 'A senha deve ter 12 a 72 caracteres, até 72 bytes, sem espaços nas pontas e não pode ser demonstrativa.');
export const ConfirmationField = () => Rule('confirmation', (v,a) => typeof v === 'string' && v === (a.object as any).password, 'As senhas informadas não são iguais.');
export const TextField = (min:number,max:number) => applyDecorators(Transform(({value}) => typeof value === 'string' ? value.trim() : value), IsString(), MinLength(min), MaxLength(max), Rule('text', v => typeof v === 'string' && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v), 'O texto contém caracteres inválidos.'));
