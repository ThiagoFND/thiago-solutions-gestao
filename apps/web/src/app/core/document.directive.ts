import { Directive, ElementRef, forwardRef, HostListener, Input } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, Validator } from '@angular/forms';

@Directive({selector:'input[appDocument]',standalone:true,providers:[
  {provide:NG_VALUE_ACCESSOR,useExisting:forwardRef(()=>DocumentDirective),multi:true},
  {provide:NG_VALIDATORS,useExisting:forwardRef(()=>DocumentDirective),multi:true},
],host:{inputmode:'numeric'}})
export class DocumentDirective implements ControlValueAccessor, Validator {
  @Input() appDocument: 'cnpj' | 'cpf' = 'cnpj';
  private change = (_:string)=>{};
  private touch = ()=>{};
  constructor(private readonly el:ElementRef<HTMLInputElement>) {}
  private digits(value:unknown) { return String(value ?? '').replace(/\D/g,'').slice(0,this.appDocument==='cnpj'?14:11); }
  writeValue(value:unknown) {
    const digits=this.digits(value);
    const groups=this.appDocument==='cnpj'?[2,3,3,4,2]:[3,3,3,2];
    const separators=this.appDocument==='cnpj'?['.','.','/','-']:['.','.','-'];
    let text='',offset=0;
    groups.forEach((size,i)=>{if(digits.length>offset)text+=(i?separators[i-1]:'')+digits.slice(offset,offset+size);offset+=size;});
    this.el.nativeElement.value=text;
  }
  registerOnChange(fn:(value:string)=>void){this.change=fn;}
  registerOnTouched(fn:()=>void){this.touch=fn;}
  setDisabledState(disabled:boolean){this.el.nativeElement.disabled=disabled;}
  validate(control:AbstractControl) {
    const digits=String(control.value ?? '');
    if(!digits)return null;
    const cnpj=this.appDocument==='cnpj';
    if(!(cnpj?/^\d{14}$/:/^\d{11}$/).test(digits)||/^(\d)\1+$/.test(digits))return {document:true};
    for(const length of cnpj?[12,13]:[9,10]) {
      const sum=[...digits.slice(0,length)].reduce((total,digit,i)=>total+Number(digit)*(cnpj?(length-1-i)%8+2:length+1-i),0);
      const expected=cnpj?(sum%11<2?0:11-sum%11):((sum*10)%11)%10;
      if(Number(digits[length])!==expected)return {document:true};
    }
    return null;
  }
  @HostListener('input') input(){const digits=this.digits(this.el.nativeElement.value);this.writeValue(digits);this.change(digits);}
  @HostListener('blur') blur(){this.touch();}
  @HostListener('beforeinput',['$event']) before(event:InputEvent){if(event.inputType==='insertText'&&event.data&&/\D/.test(event.data))event.preventDefault();}
}
