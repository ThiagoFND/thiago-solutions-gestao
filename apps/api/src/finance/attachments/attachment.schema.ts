import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as M, Types } from 'mongoose';
@Schema({collection:'financial_attachments_v2',strict:'throw',timestamps:true,autoCreate:false,autoIndex:false})
export class Attachment {
 @Prop({type:M.Types.ObjectId,required:true,immutable:true}) tenantId!:Types.ObjectId;
 @Prop({type:M.Types.ObjectId,required:true,immutable:true}) entryId!:Types.ObjectId;
 @Prop({type:String,required:true,immutable:true,select:false,match:/^[a-f0-9-]{36}\.(pdf|xml|jpg|png|webp)$/}) storageKey!:string;
 @Prop({type:String,required:true,maxlength:180}) name!:string;
 @Prop({type:String,required:true,enum:['application/pdf','application/xml','image/jpeg','image/png','image/webp']}) mime!:string;
 @Prop({type:Number,required:true,min:1,validate:Number.isSafeInteger}) size!:number;
 @Prop({type:String,required:true,match:/^[a-f0-9]{64}$/}) sha256!:string;
 @Prop({type:M.Types.ObjectId,required:true}) createdById!:Types.ObjectId;
 @Prop({type:Date}) removedAt?:Date;
 @Prop({type:M.Types.ObjectId}) removedById?:Types.ObjectId;
}
export const AttachmentSchema=SchemaFactory.createForClass(Attachment);
AttachmentSchema.index({tenantId:1,entryId:1,createdAt:1});
AttachmentSchema.index({tenantId:1,storageKey:1},{unique:true});
