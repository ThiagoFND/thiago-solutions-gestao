import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NumericInputDirective } from '../../core/numeric-input.directive';
import { KitchenProduct } from '../../core/models';
import { Ingredient, InventoryService, Purchase, Recipe, RecipeCost } from './inventory.service';

@Component({selector:'app-inventory',standalone:true,imports:[FormsModule,RouterLink,NumericInputDirective],templateUrl:'./inventory.component.html',styleUrl:'./inventory.component.scss'})
export class InventoryComponent {
  readonly auth=inject(AuthService);
  private readonly api=inject(InventoryService);
  private readonly productsApi=inject(ApiService);
  readonly units=['KG','G','L','ML','UNIDADE','CAIXA','PACOTE'];
  ingredients=signal<Ingredient[]>([]); products=signal<KitchenProduct[]>([]); purchases=signal<Purchase[]>([]);
  busy=signal(false); loading=signal(false); error=signal(''); message=signal(''); recipe=signal<Recipe|null>(null); cost=signal<RecipeCost|null>(null);
  tab:'stock'|'recipe'='stock'; search=''; onlyLow=false;
  ingredient={name:'',unit:'KG',minimumStock:'0'};
  receipt={ingredientId:'',financialEntryId:''};
  productId=''; yieldQuantity='1'; components=[{ingredientId:'',quantity:''}];
  constructor(){void this.load();}
  canManage(){return this.tab==='recipe'?this.auth.can('producao.editar'):this.auth.can('estoque.movimentar');}
  month(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife',year:'numeric',month:'2-digit'}).format(new Date());}
  number(value:string){return Number(value.replace(',','.'));}
  qty(value:number){return value.toLocaleString('pt-BR',{maximumFractionDigits:6});}
  money(cents:number){return (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  fail(error:any){this.error.set(Array.isArray(error.error?.message)?error.error.message.join('. '):error.error?.message??'Não foi possível concluir. Tente novamente.');}
  filtered(){const term=this.search.toLocaleLowerCase('pt-BR');return this.ingredients().filter(i=>i.name.toLocaleLowerCase('pt-BR').includes(term)&&(!this.onlyLow||i.stock<=i.minimumStock));}
  lowStock(){return this.ingredients().filter(i=>i.stock<=i.minimumStock).length;}
  ingredientById(id:string){return this.ingredients().find(i=>i._id===id);}
  selectedPurchase(){return this.purchases().find(p=>p._id===this.receipt.financialEntryId);}
  async load(){
    this.loading.set(true);this.error.set('');
    try{const [ingredients,products]=await Promise.all([this.api.ingredients(),firstValueFrom(this.productsApi.kitchenProducts())]);this.ingredients.set(ingredients);this.products.set(products.filter(p=>p.origin==='PRODUCED'));if(this.auth.can('estoque.visualizar','financeiro.visualizar'))await this.loadPurchases();}
    catch(error){this.fail(error);}finally{this.loading.set(false);}
  }
  async loadPurchases(){
    if(!this.auth.can('estoque.visualizar','financeiro.visualizar'))return;
    this.purchases.set([]);this.receipt.financialEntryId='';
    try{this.purchases.set((await this.api.purchases()).filter(p=>!p.received&&p.status!=='CANCELADO'));}
    catch(error){this.fail(error);}
  }
  async createIngredient(){if(this.busy()||!this.canManage())return;this.busy.set(true);this.error.set('');this.message.set('');try{await this.api.createIngredient({...this.ingredient,minimumStock:this.number(this.ingredient.minimumStock)});this.ingredient={name:'',unit:'KG',minimumStock:'0'};this.ingredients.set(await this.api.ingredients());this.message.set('Insumo cadastrado. Registre um recebimento para adicionar saldo.');}catch(error){this.fail(error);}finally{this.busy.set(false);}}
  async receive(){if(this.busy()||!this.canManage())return;const entry=this.selectedPurchase();const ingredient=this.ingredientById(this.receipt.ingredientId);if(!entry||!ingredient)return;if(!window.confirm(`Confirmar o recebimento de ${entry.quantity} ${entry.unit} de ${ingredient.name}? A compra será vinculada a este recebimento.`))return;this.busy.set(true);this.error.set('');this.message.set('');try{await this.api.receive(this.receipt);this.ingredients.set(await this.api.ingredients());this.receipt={ingredientId:'',financialEntryId:''};await this.loadPurchases();this.message.set('Recebimento registrado e saldo atualizado.');}catch(error){this.fail(error);}finally{this.busy.set(false);}}
  async selectProduct(){this.recipe.set(null);this.cost.set(null);this.components=[{ingredientId:'',quantity:''}];this.yieldQuantity='1';this.error.set('');if(!this.productId)return;this.busy.set(true);try{const recipe=await this.api.recipe(this.productId);this.recipe.set(recipe);if(recipe){this.yieldQuantity=String(recipe.yieldQuantity);this.components=recipe.components.map(c=>({ingredientId:c.ingredientId,quantity:String(c.quantity)}));this.cost.set(await this.api.cost(this.productId));}}catch(error:any){if(error.status!==404)this.fail(error);}finally{this.busy.set(false);}}
  addComponent(){if(this.components.length<50)this.components.push({ingredientId:'',quantity:''});}
  removeComponent(index:number){if(this.components.length>1)this.components.splice(index,1);}
  async saveRecipe(){if(this.busy()||!this.canManage()||!this.productId)return;if(new Set(this.components.map(c=>c.ingredientId)).size!==this.components.length){this.error.set('Use cada insumo uma única vez na ficha técnica.');return;}this.busy.set(true);this.error.set('');this.message.set('');try{const body={yieldQuantity:this.number(this.yieldQuantity),components:this.components.map(c=>({ingredientId:c.ingredientId,quantity:this.number(c.quantity)})),...(this.recipe()?{version:this.recipe()!.version}:{})};this.recipe.set(await this.api.saveRecipe(this.productId,body));this.cost.set(await this.api.cost(this.productId));this.message.set('Ficha técnica salva. A produção usará esta composição.');}catch(error){this.fail(error);}finally{this.busy.set(false);}}
}
