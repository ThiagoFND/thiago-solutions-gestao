import { Schema } from 'mongoose';
const options={timestamps:true,autoCreate:false,autoIndex:false,strict:'throw' as const},oid={type:Schema.Types.ObjectId,required:true},text=(maxlength:number)=>({type:String,trim:true,maxlength});
const base={tenantId:{...oid,immutable:true},actorId:oid,requestId:{...text(36),required:true},inputHash:text(64),version:{type:Number,default:0}};
const line=new Schema({productId:oid,productName:text(160),unit:text(30),quantity:Number,receivedQuantity:{type:Number,default:0},unitCents:Number,totalCents:Number},{_id:false,strict:'throw'});
const order=new Schema({...base,supplierId:oid,supplierName:text(160),reference:{...text(100),required:true},expectedOn:String,notes:text(4000),lines:[line],totalCents:Number,status:{type:String,enum:['DRAFT','APPROVED','PARTIAL','RECEIVED','CLOSED','CANCELED'],default:'DRAFT'},history:[{_id:false,status:String,reason:text(1000),actorId:oid,at:Date}]},{...options,collection:'purchase_orders_v2'});
const receipt=new Schema({...base,orderId:oid,reference:{...text(100),required:true},receivedOn:String,assessment:text(2000),lines:[line],totalCents:Number,stockApplied:Boolean,entryId:Schema.Types.ObjectId},{...options,collection:'purchase_receipts_v2'});
for(const s of [order,receipt]){s.index({tenantId:1,requestId:1},{unique:true});s.index({tenantId:1,reference:1},{unique:true});}
order.index({tenantId:1,status:1,expectedOn:1,_id:1});receipt.index({tenantId:1,orderId:1,_id:1});
export const PURCHASE_MODELS=[{name:'PurchaseOrder',schema:order},{name:'PurchaseReceipt',schema:receipt}];
