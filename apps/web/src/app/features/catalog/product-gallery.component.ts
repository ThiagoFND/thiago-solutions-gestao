import { Component, computed, input, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catalogImageUrl } from './catalog-image-url';

@Component({
  selector: 'app-product-gallery', standalone: true,
  templateUrl: './product-gallery.component.html', styleUrl: './product-gallery.component.scss',
})
export class ProductGalleryComponent {
  name=input.required<string>();main=input<string>('');additional=input<string[]>([]);
  preview=input(false);featured=input(false);
  images=computed(()=>[...new Set([this.main(),...(this.additional()??[])].filter(Boolean))].slice(0,7));
  selected=signal(0);failed=signal<ReadonlySet<string>>(new Set());
  index=computed(()=>Math.min(this.selected(),Math.max(0,this.images().length-1)));
  current=computed(()=>this.images()[this.index()]);
  private start:{x:number;y:number}|null=null;
  url(value:string){return catalogImageUrl(value,environment.apiUrl,this.preview());}
  credentials(value:string){return value.startsWith('/api/public/images/')?'use-credentials':null;}
  choose(index:number){this.selected.set(index);}
  move(delta:number){const count=this.images().length;if(count>1)this.selected.set((this.index()+delta+count)%count);}
  error(url:string){this.failed.update(previous=>new Set([...previous,url]));}
  key(event:KeyboardEvent){if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();this.move(event.key==='ArrowRight'?1:-1);}}
  touchStart(event:TouchEvent){const p=event.touches[0];this.start=event.touches.length===1?{x:p.clientX,y:p.clientY}:null;}
  touchEnd(event:TouchEvent){const start=this.start;this.start=null;const end=event.changedTouches[0];if(!start||!end)return;const dx=end.clientX-start.x,dy=end.clientY-start.y;if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.3)this.move(dx<0?1:-1);}
}
