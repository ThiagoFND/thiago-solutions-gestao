import { environment } from '../../../environments/environment';
import { catalogImageUrl } from '../catalog/catalog-image-url';
import { ImageUploadComponent } from '../catalog/image-upload.component';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Product, ProductOrigin } from '../../core/models';
import { CatalogApi, errorText } from '../catalog/catalog-api.service';
@Component({selector:'app-products',standalone:true,imports:[ImageUploadComponent,FormsModule,RouterLink],templateUrl:'./products.component.html',styleUrl:'../catalog/admin.scss'})
export class ProductsComponent implements OnInit {
  products=signal<Product[]>([]);categories=signal<any[]>([]);editingId:string|null=null;form=this.empty();saving=signal(false);loading=signal(false);message=signal('');
  constructor(private readonly api:ApiService,private readonly catalog:CatalogApi,public readonly auth:AuthService){}
  ngOnInit(){this.load();this.catalog.get('categories',{limit:100}).subscribe({next:r=>this.categories.set(r.items),error:e=>this.message.set(errorText(e))});}
  load(){this.loading.set(true);this.api.products().subscribe({next:r=>{this.products.set(r.sort((a,b)=>(a.categoryOrder??0)-(b.categoryOrder??0)||(a.internalOrder??0)-(b.internalOrder??0)));this.loading.set(false);},error:e=>{this.loading.set(false);this.message.set(errorText(e));}});}
  empty(){return{name:'',categoryId:'',origin:'PRODUCED' as ProductOrigin,supplyMode:'CONTROLADO_POR_ESTOQUE',price:0,minimumStock:0,active:true,imageUrl:'',shortDescription:'',description:'',unit:'un',additionalImages:[] as string[],published:false,manuallyHidden:false,featured:false,publicOrder:0,internalOrder:0,version:0};}
  edit(p:Product){this.editingId=p._id;this.form=Object.fromEntries(Object.keys(this.empty()).map(k=>[k,k==='price'?p.priceCents/100:(p as any)[k]??(this.empty() as any)[k]])) as any;}
  reset(){this.editingId=null;this.form=this.empty();}
  addImage(url:string){if(this.form.additionalImages.length<6)this.form.additionalImages=[...this.form.additionalImages,url];}
  removeImage(index:number){this.form.additionalImages=this.form.additionalImages.filter((_,i)=>i!==index);}
  supply(){if(this.form.supplyMode!=='CONTROLADO_POR_ESTOQUE'){this.form.origin=this.form.supplyMode==='PRODUZIDO_SOB_DEMANDA'?'PRODUCED':'PURCHASED_FOR_RESALE';this.form.published=true;}}
  previewImage(url:string){return catalogImageUrl(url,environment.apiUrl,true);}
  save(f:NgForm){if(this.saving())return;if(f.invalid){f.control.markAllAsTouched();this.message.set('Confira os campos obrigatórios e os limites.');return;}const cents=Math.round(this.form.price*100);if(!Number.isSafeInteger(cents)||Math.abs(cents-this.form.price*100)>0.00001){this.message.set('Use no máximo duas casas decimais no preço.');return;}const {price,...base}=this.form;const dto:any={...base,priceCents:cents};if(!this.auth.can('produtos.publicar'))for(const k of ['published','manuallyHidden','featured'])delete dto[k];if(!this.auth.can('produtos.ordenar'))for(const k of ['publicOrder','internalOrder'])delete dto[k];if(!this.auth.can('produtos.arquivar'))delete dto.active;this.saving.set(true);(this.editingId?this.api.updateProduct(this.editingId,dto):this.api.createProduct(dto)).subscribe({next:()=>{this.saving.set(false);this.reset();this.message.set('Produto salvo.');this.load();},error:e=>{this.saving.set(false);this.message.set(errorText(e));}});}
  purchase(p:Product){const raw=prompt('Quantidade comprada (unidades inteiras):');if(raw===null)return;const quantity=Number(raw);if(!Number.isInteger(quantity)||quantity<1||quantity>1000000){this.message.set('Informe uma quantidade inteira de 1 a 1000000.');return;}if(this.saving())return;this.saving.set(true);this.api.purchaseProduct(p._id,quantity).subscribe({next:()=>{this.saving.set(false);this.message.set('Entrada registrada. A disponibilidade pública é recalculada automaticamente.');this.load();},error:e=>{this.saving.set(false);this.message.set(errorText(e));}});}
  mode(mode?:string){return({CONTROLADO_POR_ESTOQUE:'Controlado por estoque',PRODUZIDO_SOB_DEMANDA:'Produzido sob demanda',COMPRADO_SOB_DEMANDA:'Comprado sob demanda'} as Record<string,string>)[mode??'']??'Cadastro legado';}
  money(c:number){return(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
}
