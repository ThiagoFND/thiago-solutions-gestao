import { ProductGalleryComponent } from './product-gallery.component';
import { environment } from '../../../environments/environment';
import { catalogImageUrl } from './catalog-image-url';
import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { CatalogApi, errorText } from './catalog-api.service';
@Component({ selector:'app-public-catalog', standalone:true, imports:[FormsModule,RouterLink,ProductGalleryComponent], templateUrl:'./public-catalog.component.html', styleUrl:'./public-catalog.component.scss' })
export class PublicCatalogComponent implements OnInit, OnDestroy {
  data=signal<any>(null);loading=signal(true);message=signal('');search='';category='';page=1;preview=false;private slug='';private request=0;
  constructor(private readonly router:Router,private readonly api:CatalogApi,private readonly route:ActivatedRoute,private readonly title:Title,private readonly meta:Meta){}
  ngOnInit(){this.preview=this.route.snapshot.data['preview']===true;this.slug=this.route.snapshot.paramMap.get('slug')??'';this.load();}
  ngOnDestroy(){this.request++;this.title.setTitle('Thiago Solutions Digitais');this.meta.removeTag('property="og:title"');this.meta.removeTag('property="og:description"');}
  load(reset=false){if(reset)this.page=1;const req=++this.request;this.loading.set(true);this.message.set('');this.api.get(this.preview?'landing/preview':`public/companies/${encodeURIComponent(this.slug)}`,{page:this.page,limit:24,...(this.search?{search:this.search}:{}),...(this.category?{category:this.category}:{})}).subscribe({next:d=>{if(req!==this.request)return;this.data.set(d);this.loading.set(false);this.title.setTitle(d.company.shareTitle||d.company.publicName);this.meta.updateTag({property:'og:title',content:d.company.shareTitle||d.company.publicName});this.meta.updateTag({property:'og:description',content:d.company.shareDescription||d.company.description});},error:e=>{if(req!==this.request)return;this.loading.set(false);this.data.set(null);this.message.set(e.status===404?'Esta vitrine não está disponível.':errorText(e));}});}
  sectionLink(section:string){return this.router.url.split('#')[0]+'#'+section;}
  select(key:string){this.category=key;this.load(true);}
  products(key:string){return this.data()?.products.filter((p:any)=>p.categoryKey===key)??[];}
  money(cents:number){return(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  imageCredentials(url:string){return url?.startsWith('/api/public/images/')?'use-credentials':null;}
  imageUrl(url:string){return catalogImageUrl(url,environment.apiUrl,this.preview);}
  broken(event:Event){const img=event.target as HTMLImageElement;img.hidden=true;const fallback=img.ownerDocument.createElement('span');fallback.className='image-fallback';fallback.setAttribute('role','img');fallback.setAttribute('aria-label',img.alt||'Imagem indisponível');fallback.textContent='Imagem indisponível';img.after(fallback);}
}
