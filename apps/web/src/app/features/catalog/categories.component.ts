import { ImageUploadComponent } from './image-upload.component';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CatalogApi, errorText } from './catalog-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-categories',standalone:true,imports:[ImageUploadComponent,FormsModule],templateUrl:'./categories.component.html',styleUrl:'./admin.scss'})
export class CategoriesComponent implements OnInit {
  rows=signal<any[]>([]);message=signal('');busy=signal(false);loading=signal(true);editing='';form=this.empty();linked=signal<any>(null);destination='';
  constructor(private readonly api:CatalogApi,public readonly auth:AuthService){}
  ngOnInit(){this.load();}
  empty(){return{name:'',description:'',imageUrl:'',icon:'',color:'violet',active:true,published:false,archived:false,publicOrder:0,internalOrder:0,version:0};}
  load(){this.loading.set(true);this.api.get('categories',{limit:100}).subscribe({next:r=>{this.rows.set(r.items);this.loading.set(false);},error:e=>{this.loading.set(false);this.message.set(errorText(e));}});}
  edit(row:any){this.editing=row._id;this.form=Object.fromEntries(Object.keys(this.empty()).map(k=>[k,row[k]??(this.empty() as any)[k]])) as any;this.linked.set(null);}
  reset(){this.editing='';this.form=this.empty();this.linked.set(null);}
  save(form:NgForm){if(this.busy())return;if(form.invalid){form.control.markAllAsTouched();this.message.set('Confira os campos obrigatórios.');return;}this.busy.set(true);const dto:any={...this.form};if(!this.auth.can('categorias.publicar'))delete dto.published;if(!this.auth.can('categorias.ordenar')){delete dto.publicOrder;delete dto.internalOrder;}if(!this.auth.can('categorias.arquivar')){delete dto.archived;delete dto.active;}const req=this.editing?this.api.patch(`categories/${this.editing}`,dto):this.api.post('categories',dto);req.subscribe({next:()=>{this.busy.set(false);this.reset();this.message.set('Categoria salva.');this.load();},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});}
  order(row:any,field:'publicOrder'|'internalOrder',delta:number){if(this.busy())return;this.busy.set(true);this.api.post(`categories/${row._id}/order`,{version:row.version,scope:field,direction:delta<0?'UP':'DOWN'}).subscribe({next:()=>{this.busy.set(false);this.load();},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});}
  products(row:any){this.edit(row);this.api.get(`categories/${row._id}/products`,{limit:100}).subscribe({next:r=>this.linked.set(r),error:e=>this.message.set(errorText(e))});}
  move(){if(!this.destination||this.busy()||!confirm('Mover todos os produtos desta categoria para a categoria selecionada?'))return;this.busy.set(true);this.api.post(`categories/${this.editing}/move-products`,{destinationId:this.destination,version:this.form.version}).subscribe({next:r=>{this.busy.set(false);this.message.set(`${r.moved} produtos movidos.`);this.reset();this.load();},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});}
}
