import { Component, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { errorText } from './catalog-api.service';
@Component({selector:'app-image-upload',standalone:true,template:`@if(auth.can('empresa.configurar')){<label>{{label()}}<input type="file" accept="image/png,image/jpeg,image/webp" [disabled]="busy()" (change)="upload($event)"><small>PNG, JPEG ou WEBP, até 2 MiB.</small></label>@if(message()){<p role="status">{{message()}}</p>}}`,styles:[`:host{display:block}label{display:grid;gap:7px;font-size:13px;margin:14px 0}input{max-width:100%}small,p{font-size:12px;color:#676e83}`]})
export class ImageUploadComponent {
  label=input('Enviar imagem');uploaded=output<string>();busy=signal(false);message=signal('');
  constructor(private readonly http:HttpClient,public readonly auth:AuthService){}
  upload(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;if(file.size>2*1024*1024){this.message.set('Limite de 2 MiB excedido.');input.value='';return;}const data=new FormData();data.append('file',file);this.busy.set(true);this.http.post<{url:string}>(`${environment.apiUrl}/catalog-images`,data).subscribe({next:r=>{this.busy.set(false);this.uploaded.emit(r.url);this.message.set('Imagem enviada. Salve o formulário para aplicar.');input.value='';},error:e=>{this.busy.set(false);this.message.set(errorText(e));input.value='';}});}
}
