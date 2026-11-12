import type {Product,RecordRow} from '@shared/domain';
export interface Choice {key:string;label:string;sub:string;price:number;product_id:string;bottles:number;bundle_id?:string;}
export interface CartItem extends Choice {blend:'GLT'|'GOT';size:string;quantity:number;}
/** Cards exist only for active backend variants; copy and imagery come from those variants. */
export function catalogueBlends(products:Product[]){
 const active=products.filter(product=>product.active!==false);
 return [...new Set(active.map(product=>product.blend))].sort().map(blend=>{
  const variants=active.filter(product=>product.blend===blend).sort((a,b)=>a.volume_ml-b.volume_ml);
  return {id:blend as 'GLT'|'GOT',variants};
 });
}
export function catalogueChoices(products:Product[],bundles:RecordRow[],blend:string):Choice[]{
 const variants=products.filter(product=>product.blend===blend&&product.active!==false).sort((a,b)=>a.volume_ml-b.volume_ml);
 return [...variants.map(product=>({key:product.id,label:`${product.volume_ml} ml`,sub:product.volume_ml===60?'single shot':product.volume_ml===120?'double pour':'multi-use',price:Number(product.price),product_id:product.id,bottles:1})),...bundles.filter(bundle=>bundle.active&&variants.some(product=>product.id===bundle.product_id)).map(bundle=>{const product=variants.find(product=>product.id===bundle.product_id)!;return {key:String(bundle.id),label:`${bundle.quantity} × ${product.volume_ml} ml`,sub:String(bundle.name),price:Number(bundle.price),product_id:product.id,bottles:Number(bundle.quantity),bundle_id:String(bundle.id)};})];
}
export function requestLines(cart:CartItem[]){
 const lines:{product_id:string;quantity:number;bundle_id?:string}[]=[];
 for(const item of cart){if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100)throw Error('Choose between 1 and 100 of each item.');if(item.bundle_id){for(let pack=0;pack<item.quantity;pack++)lines.push({product_id:item.product_id,quantity:item.bottles,bundle_id:item.bundle_id});}else lines.push({product_id:item.product_id,quantity:item.quantity});}
 if(!lines.length||lines.length>20)throw Error('Choose up to 20 product lines or packs per request.');
 return lines;
}
