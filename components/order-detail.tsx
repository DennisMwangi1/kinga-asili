'use client';
import Image from 'next/image';
import { MapPin, CalendarDays, Phone, Download, Pencil, Truck, UserRound } from 'lucide-react';
import { type Order, type Product, money } from '@/lib/domain';

const statusLabels:Record<string,string>={requested:'Awaiting confirmation',confirmed:'Confirmed',packed:'Ready for dispatch',dispatched:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'};
function date(value:string){return value?new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Nairobi'}).format(new Date(value.length===10?value+'T12:00:00+03:00':value)):'Date not set';}
export default function OrderDetail({order,products,onEdit,onDelivery,onExport}:{order:Order;products:Product[];onEdit?:()=>void;onDelivery:()=>void;onExport:()=>void}) {
 const outstanding=Math.max(0,order.total-order.paid);
 const subtotal=order.lines.reduce((sum,line)=>sum+(line.quantity-(line.free_quantity||0))*line.unit_price,0);
 const phone=/^(?:254|0)[17]\d{8}$/.test(order.phone);
 const notes=order.notes?.trim();
 const showNotes=!!notes&&!/^DEMONSTRATION RECORD\b/i.test(notes);
 return <div className="order-detail">
   <section className="order-customer-summary">
     <div className="order-person"><span className="order-person-avatar"><UserRound size={22} strokeWidth={1.75}/></span><div><h3>{order.customer_name}</h3><p>{date(order.created_at)}</p></div><span className={'order-status status-'+order.status}>{statusLabels[order.status]||order.status}</span></div>
     <div className="order-contact-line"><MapPin size={17}/><span>{order.location||'Delivery location not set'}</span></div>
     {phone&&<a className="order-contact-line" href={'tel:'+order.phone}><Phone size={17}/><span>{order.phone}</span></a>}
   </section>
   <section className="order-detail-section"><div className="order-section-heading"><h3>Items</h3><span>{order.lines.reduce((sum,line)=>sum+line.quantity,0)} bottles</span></div>
     <div className="order-items">{order.lines.map((line,index)=>{const product=products.find(p=>p.id===line.product_id);return <div className="order-detail-item" key={index}>
       <div className="order-item-photo">{product?.image?<Image src={product.image} alt="" width={48} height={64}/>:<ShoppingPlaceholder/>}</div>
       <div className="order-item-copy"><strong>{product?.name||'Blend'}</strong><span>{product?.volume_ml?product.volume_ml+' ml · ':''}{line.quantity} × {money(line.unit_price)}</span>{!!line.free_quantity&&<small>{line.free_quantity} free included</small>}</div>
       <strong className="order-line-amount">{money((line.quantity-(line.free_quantity||0))*line.unit_price)}</strong>
     </div>;})}</div>
   </section>
   <section className="order-totals" aria-label="Order amounts"><div><span>Subtotal</span><span>{money(subtotal)}</span></div><div><span>Delivery fee</span><span>{money(order.delivery_fee)}</span></div>{order.discount>0&&<div><span>Discount</span><span>−{money(order.discount)}</span></div>}<div className="order-total-line"><strong>Order total</strong><strong>{money(order.total)}</strong></div><div><span>Payment received</span><span>{money(order.paid)}</span></div><div className={'order-balance '+(outstanding>0?'has-balance':'settled')}><span>{outstanding>0?'Balance due':'Fully paid'}</span><strong>{money(outstanding)}</strong></div></section>
   <section className="order-delivery-summary"><div className="order-section-heading"><h3>Delivery</h3>{!['requested','cancelled'].includes(order.status)&&<button className="text-button" onClick={onDelivery}><Pencil size={15}/>Edit</button>}</div><p><CalendarDays size={17}/><span>{date(order.delivery_date)}</span></p><p><Truck size={17}/><span>{order.location||'Location not set'}</span></p>{order.exception_reason&&<p className="order-exception">{order.exception_reason}</p>}</section>
   {showNotes&&<section className="order-detail-section"><h3>Notes</h3><p className="order-notes">{notes}</p></section>}
   <div className="order-detail-secondary">{order.status==='requested'&&onEdit&&<button onClick={onEdit}><Pencil size={16}/>Edit request</button>}{phone&&<a href={'https://wa.me/'+order.phone.replace(/^0/,'254')} target="_blank" rel="noreferrer"><Phone size={16}/>WhatsApp</a>}<button onClick={onExport}><Download size={16}/>Export order</button></div>
 </div>;
}
function ShoppingPlaceholder(){return <span aria-hidden="true">K</span>;}
