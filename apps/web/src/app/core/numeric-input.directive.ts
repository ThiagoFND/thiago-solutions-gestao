import { Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, Output, forwardRef } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';

/** Keeps decimal strings intact: conversion to cents remains the caller's responsibility. */
@Directive({
  selector: 'input[appNumericInput]',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumericInputDirective), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NumericInputDirective), multi: true },
  ],
})
export class NumericInputDirective implements ControlValueAccessor, Validator {
  @Input() numericDecimals = 2;
  @Input() numericMin = 0.01;
  @Input() numericMax = 10_000_000_000;
  @Output() numericRejected = new EventEmitter<string>();
  @HostBinding('attr.inputmode') get inputMode() { return this.numericDecimals ? 'decimal' : 'numeric'; }
  private previousValue = '';
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly element: ElementRef<HTMLInputElement>) {}
  writeValue(value: unknown) {
    this.previousValue = value == null ? '' : String(value);
    this.element.nativeElement.value = this.previousValue;
  }
  registerOnChange(fn: (value: string) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void) { this.onTouched = fn; }
  setDisabledState(disabled: boolean) { this.element.nativeElement.disabled = disabled; }
  validate(control: AbstractControl): ValidationErrors | null {
    const text = control.value == null ? '' : String(control.value);
    if (!text) return null;
    const number = Number(text.replace(',', '.'));
    return this.accepts(text) && /\d$/.test(text) && number >= this.numericMin
      ? null : { numericInput: { min: this.numericMin, max: this.numericMax, decimals: this.numericDecimals } };
  }
  private accepts(value: string) {
    if (!value) return true;
    const pattern = this.numericDecimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:[,.]\\d{0,${this.numericDecimals}})?$`);
    return pattern.test(value) && Number(value.replace(',', '.')) <= this.numericMax;
  }
  private insertedValue(text: string) {
    const input = this.element.nativeElement;
    return input.value.slice(0, input.selectionStart ?? input.value.length) + text + input.value.slice(input.selectionEnd ?? input.value.length);
  }
  private reject() {
    this.numericRejected.emit(this.numericDecimals
      ? `Use somente números, sem separador de milhar, com até ${this.numericDecimals} casas decimais (vírgula ou ponto). Máximo: ${this.numericMax.toLocaleString('pt-BR')}. O valor anterior foi mantido.`
      : `Use somente números inteiros até ${this.numericMax.toLocaleString('pt-BR')}. O valor anterior foi mantido.`);
  }
  @HostListener('beforeinput', ['$event']) beforeInput(event: InputEvent) {
    if (event.data != null && !this.accepts(this.insertedValue(event.data))) { event.preventDefault(); this.reject(); }
  }
  @HostListener('paste', ['$event']) paste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text');
    if (text != null && !this.accepts(this.insertedValue(text))) { event.preventDefault(); this.reject(); }
  }
  @HostListener('input') input() {
    const input = this.element.nativeElement;
    if (!this.accepts(input.value)) { input.value = this.previousValue; this.reject(); return; }
    this.previousValue = input.value;
    this.numericRejected.emit('');
    this.onChange(input.value);
  }
  @HostListener('blur') blur() { this.onTouched(); }
}
