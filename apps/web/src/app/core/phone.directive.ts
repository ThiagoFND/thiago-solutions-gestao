import { Directive, forwardRef, HostListener, ElementRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, Validator, AbstractControl } from '@angular/forms';
@Directive({selector:'input[appPhone]',standalone:true,providers:[{provide:NG_VALUE_ACCESSOR,useExisting:forwardRef(()=>PhoneDirective),multi:true},{provide:NG_VALIDATORS,useExisting:forwardRef(()=>PhoneDirective),multi:true}]})
export class PhoneDirective implements ControlValueAccessor, Validator {
  private change = (_:string)=>{}; private touch = ()=>{};
  constructor(private el:ElementRef<HTMLInputElement>){}
  writeValue(value:string){ const d=(value??'').replace(/\D/g,'').slice(0,11); this.el.nativeElement.value=d.length>2?'('+d.slice(0,2)+') '+(d.length>10?d.slice(2,7)+'-'+d.slice(7):d.slice(2,6)+(d.length>6?'-'+d.slice(6):'')):d; }
  registerOnChange(fn:any){this.change=fn;} registerOnTouched(fn:any){this.touch=fn;}
  setDisabledState(v:boolean){this.el.nativeElement.disabled=v;}
  validate(c:AbstractControl){return !c.value || /^\d{10,11}$/.test(c.value)?null:{phone:true};}
  @HostListener('input') input(){const d=this.el.nativeElement.value.replace(/\D/g,'').slice(0,11);this.change(d);this.writeValue(d);}
  @HostListener('blur') blur(){this.touch();}
  @HostListener('beforeinput',['$event']) before(e:InputEvent){if(e.inputType==='insertText' && e.data && /\D/.test(e.data))e.preventDefault();}
}
