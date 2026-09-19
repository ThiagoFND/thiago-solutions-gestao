import { ImageUploadComponent } from './image-upload.component';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { CatalogApi, errorText } from './catalog-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-landing-config',standalone:true,imports:[ImageUploadComponent,FormsModule,RouterLink],templateUrl:'./landing-config.component.html',styleUrl:'./admin.scss'})
export class LandingConfigComponent implements OnInit {
  form={slug:'',publicName:'',logoUrl:'',coverUrl:'',slogan:'',description:'',presentation:'',theme:'violet',phone:'',whatsapp:'',publicEmail:'',address:'',hours:'',socialLinks:[] as string[],sections:['featured','products','about','contact'],additionalInfo:'',contactUrl:'',contactLabel:'Fale conosco',operatingNotice:'',shareTitle:'',shareDescription:'',hideUnavailable:false,showDemandLabel:true,showPrices:true,version:0};
  social='';saved=signal<any>(null);busy=signal(false);loading=signal(true);message=signal('');qr=signal('');errors=signal<string[]>([]);
  sections=[{key:'featured',label:'Destaques'},{key:'products',label:'Produtos'},{key:'about',label:'Sobre a empresa'},{key:'contact',label:'Contatos'}];
  constructor(private readonly api:CatalogApi,public readonly auth:AuthService){}
  ngOnInit(){this.api.get('landing').subscribe({next:d=>{this.loading.set(false);if(d)this.accept(d);},error:e=>{this.loading.set(false);this.message.set(errorText(e));}});}
  accept(d:any){this.saved.set(d);this.form=Object.fromEntries(Object.keys(this.form).map(k=>[k,d[k]??(this.form as any)[k]])) as any;this.social=this.form.socialLinks.join('\n');void QRCode.toDataURL(this.link(),{width:256,margin:4,errorCorrectionLevel:'M'}).then(url=>this.qr.set(url)).catch(()=>this.message.set('Não foi possível gerar o QR Code.'));}
  link(){return this.saved()?`${location.origin}/empresa/${this.saved().slug}`:'';}
  toggle(key:string,checked:boolean){this.form.sections=checked?[...this.form.sections,key]:this.form.sections.filter(s=>s!==key);}
  payload(){return {...this.form,socialLinks:this.social.split('\n').map(x=>x.trim()).filter(Boolean)};}
  unsaved(){const saved=this.saved();return !saved||Object.entries(this.payload()).some(([key,value])=>key!=='version'&&JSON.stringify(value)!==JSON.stringify(saved[key]));}
  save(f:NgForm){
    if(this.busy()||this.loading())return;
    f.control.markAllAsTouched();
    const labels:Record<string,string>={slug:'Endereço público: use de 3 a 70 letras minúsculas, números e hífens.',publicName:'Nome público: informe de 2 a 160 caracteres.',phone:'Telefone: informe de 10 a 15 dígitos, sem espaços ou pontuação.',whatsapp:'WhatsApp: informe de 10 a 15 dígitos, com país e DDD, sem pontuação.',publicEmail:'E-mail público: informe um e-mail válido.',contactLabel:'Texto do botão: informe de 1 a 60 caracteres.',social:'Redes sociais: confira o limite de tamanho.'};
    const errors=Object.entries(f.controls).filter(([,control])=>control.invalid).map(([key])=>labels[key]??`Confira o campo ${key} e seu limite de tamanho.`);
    const dto=this.payload();
    if(dto.socialLinks.length>8||dto.socialLinks.some(url=>!/^https:\/\/[^\s]+$/.test(url)||url.length>2048))errors.push('Redes sociais: use até 8 links completos iniciados por https://, um por linha.');
    if(dto.contactUrl&&!/^https:\/\/[^\s]+$/.test(dto.contactUrl))errors.push('Link do botão de contato: use um endereço completo iniciado por https://.');
    this.errors.set(errors);
    if(errors.length){this.message.set('Não foi possível salvar. Corrija os campos indicados; suas alterações foram mantidas.');return;}
    this.busy.set(true);
    this.api.put('landing',dto).subscribe({next:d=>{this.busy.set(false);this.accept(d);f.control.markAsPristine();this.message.set('Configuração salva. Confira a pré-visualização antes de publicar.');},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});
  }
  publish(value:boolean){
    if(this.busy()||!this.saved())return;
    if(this.unsaved()){this.message.set('Existem alterações não salvas. Salve a configuração antes de publicar ou despublicar.');return;}
    if(!confirm(value?'Publicar a vitrine com os dados salvos?':'Despublicar a vitrine? O link deixará de exibir o catálogo.'))return;
    this.busy.set(true);this.api.post(`landing/${value?'publish':'unpublish'}`,{version:this.saved().version}).subscribe({next:d=>{this.busy.set(false);this.accept(d);this.message.set(value?'Vitrine publicada.':'Vitrine despublicada.');},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});
  }
  async copy(){try{await navigator.clipboard.writeText(this.link());this.message.set('Link copiado.');}catch{this.message.set('Selecione e copie o link exibido abaixo.');}}
}
