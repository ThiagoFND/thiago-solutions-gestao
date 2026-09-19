import { BadRequestException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Post, Res, SetMetadata, UploadedFile, UseInterceptors } from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Model, Schema as M, Types } from 'mongoose';
import type { Response } from 'express';
import { Permissions } from '../auth/permissions.js';
import { Public } from '../auth/public.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { TenantStatus, UserStatus, SupplyMode, AvailabilityMode } from '../common/enums.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { validateAttachment } from '../finance/attachments/attachment-validation.js';
import { assertStorageQuota } from '../common/storage-quota.js';
@Schema({ collection: 'catalog_images_v2', timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false })
export class CatalogImage {
  @Prop({ type: M.Types.ObjectId, required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ required: true, enum: ['image/png','image/jpeg','image/webp'] }) mime!: string;
  @Prop({ type: Buffer, required: true, select: false }) bytes!: Buffer;
  @Prop({ type: M.Types.ObjectId, required: true }) createdById!: Types.ObjectId;
}
export const CatalogImageSchema=SchemaFactory.createForClass(CatalogImage);
CatalogImageSchema.index({tenantId:1,_id:1});
@Injectable()
class ImagesService {
  constructor(@InjectModel(CatalogImage.name) private readonly images:Model<CatalogImage>,private readonly access:TenantAccessService,private readonly entitlements:EntitlementsService){}
  async upload(file:any,u:AuthUser){
    const actor=await this.access.require(u,['empresa.configurar']);
    if(!file?.buffer || file.buffer.length>2*1024*1024)throw new BadRequestException('Envie uma imagem de até 2 MiB.');
    const type=await validateAttachment(file);
    if(!['image/png','image/jpeg','image/webp'].includes(type.mime!))throw new BadRequestException('Use PNG, JPEG ou WEBP.');
    if(await this.images.countDocuments({tenantId:actor.tenantId})>=500)throw new BadRequestException('Limite de 500 imagens atingido. Reutilize uma imagem cadastrada.');
    const row=await this.access.transaction(async session=>{const fresh=await this.access.require(actor,['empresa.configurar'],session);await this.access.tenants.updateOne({_id:fresh.tenantId},{$inc:{membershipVersion:1}},{session});if(await this.images.countDocuments({tenantId:fresh.tenantId}).session(session)>=500)throw new BadRequestException('Limite de 500 imagens atingido.');await assertStorageQuota(this.access.connection,fresh.tenantId!,file.buffer.length,(await this.entitlements.resolve(fresh.tenantId!,session)).limits?.storageBytes,session);return (await this.images.create([{tenantId:fresh.tenantId!,mime:type.mime,bytes:file.buffer,createdById:fresh.sub}],{session}))[0];});
    return {url:`/api/public/images/${row._id}`,previewUrl:`/api/catalog-images/${row._id}`};
  }
  async internal(id:string,u:AuthUser){const actor=await this.access.identity(u.sub);if(actor.status!==UserStatus.ACTIVE||actor.tenantStatus!==TenantStatus.ACTIVE||!actor.tenantId)throw new ForbiddenException();return this.find(id,actor.tenantId);}
  async find(id:string,tenantId?:string){const image=await this.images.findOne({_id:id,...(tenantId?{tenantId}:{})}).select('+bytes');if(!image)throw new NotFoundException();return image;}
  async publicImage(id:string){
    const image=await this.find(id);const tenantId=image.tenantId;
    if(!await this.access.tenants.exists({_id:tenantId,status:TenantStatus.ACTIVE}))throw new NotFoundException();
    if(!await this.entitlements.has(String(tenantId),'LANDING_PAGE'))throw new NotFoundException();
    const page=await this.access.connection.model('LandingConfig').findOne({tenantId,published:true}).lean() as any;
    if(!page)throw new NotFoundException();
    const url=`/api/public/images/${id}`;
    let visible=page.logoUrl===url||page.coverUrl===url;
    if(!visible){const categories=await this.access.connection.model('Category').find({tenantId,active:true,published:true,archived:false}).select('_id imageUrl').lean();
      visible=categories.some((c:any)=>c.imageUrl===url);
      if(!visible){const stockFilter=page.hideUnavailable&&await this.entitlements.has(String(tenantId),'INVENTORY')?{$or:[{supplyMode:{$in:[SupplyMode.PRODUZIDO_SOB_DEMANDA,SupplyMode.COMPRADO_SOB_DEMANDA]}},{supplyMode:{$exists:false},availabilityMode:AvailabilityMode.MADE_TO_ORDER},{availableStock:{$gt:0}}]}:{};
        visible=!!await this.access.connection.model('Product').exists({tenantId,categoryId:{$in:categories.map(c=>c._id)},active:true,published:true,manuallyHidden:{$ne:true},$and:[{$or:[{imageUrl:url},{additionalImages:url}]},stockFilter]});}
    }
    if(!visible)throw new NotFoundException();return image;
  }
}
function send(res:Response,image:CatalogImage){res.setHeader('Content-Type',image.mime);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition','inline; filename="imagem.'+(image.mime==='image/jpeg'?'jpg':image.mime.split('/')[1])+'"');res.send(image.bytes);}
@Controller('catalog-images')
export class CatalogImagesController {
  constructor(private readonly service:ImagesService){}
  @Post() @Permissions('empresa.configurar') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:2*1024*1024,files:1,fields:0,parts:2}})) upload(@UploadedFile() file:any,@CurrentUser() u:AuthUser){return this.service.upload(file,u);}
  @Get(':id') @SetMetadata('sessionOnly',true) async preview(@Param('id') id:string,@CurrentUser() u:AuthUser,@Res() res:Response){send(res,await this.service.internal(id,u));}
}
@Controller('public/images')
export class PublicImagesController {
  constructor(private readonly service:ImagesService){}
  @Public() @Get(':id') async image(@Param('id') id:string,@Res() res:Response){send(res,await this.service.publicImage(id));}
}
@Module({imports:[MongooseModule.forFeature([{name:CatalogImage.name,schema:CatalogImageSchema}])],controllers:[CatalogImagesController,PublicImagesController],providers:[ImagesService]})
export class CatalogImagesModule{}
