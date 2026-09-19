import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Ingredient { _id:string; name:string; unit:string; stock:number; minimumStock:number; stockValueCents:number; averageUnitCostCents:number|null; version:number }
export interface Purchase { _id:string; description:string; quantity:number; unit:string; expectedAmountCents:number; purchaseDate:string; status:string; received:boolean }
interface Page<T>{items:T[];total:number;page:number;limit:number;totalPages:number}
export interface RecipeComponent { ingredientId:string; quantity:number }
export interface Recipe { productId:string; yieldQuantity:number; version:number; components:RecipeComponent[] }
export interface RecipeCost { available:boolean; reason?:string; totalCostCents:number|null; unitCostCents:number|null; yieldQuantity:number; version:number; components:Array<{ingredientId:string;name:string;unit:string;quantity:number;stock:number;costCents:number|null}> }

@Injectable({providedIn:'root'})
export class InventoryService {
  private readonly url=`${environment.apiUrl}/inventory`;
  constructor(private readonly http:HttpClient){}
  private async all<T>(path:string){const items:T[]=[];let page=1;while(true){const result=await firstValueFrom(this.http.get<Page<T>>(`${this.url}/${path}`,{params:{page,limit:100}}));items.push(...result.items);if(page>=result.totalPages)return items;page++;}}
  ingredients(){return this.all<Ingredient>('ingredients');}
  purchases(){return this.all<Purchase>('purchases');}
  createIngredient(body:{name:string;unit:string;minimumStock:number}){return firstValueFrom(this.http.post<Ingredient>(`${this.url}/ingredients`,body));}
  receive(body:{financialEntryId:string;ingredientId:string}){return firstValueFrom(this.http.post(`${this.url}/receipts`,body));}
  recipe(productId:string){return firstValueFrom(this.http.get<Recipe|null>(`${this.url}/recipes/${productId}`));}
  saveRecipe(productId:string,body:{yieldQuantity:number;components:RecipeComponent[];version?:number}){return firstValueFrom(this.http.put<Recipe>(`${this.url}/recipes/${productId}`,body));}
  cost(productId:string){return firstValueFrom(this.http.get<RecipeCost>(`${this.url}/recipes/${productId}/cost`));}
}
