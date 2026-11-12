import {eatDate,type Order} from './domain';
export function salesSeries(orders:Order[],from:string,to:string){
 const labels:string[]=[],points:number[]=[];
 for(let stamp=Date.parse(from+'T12:00:00Z');stamp<=Date.parse(to+'T12:00:00Z')&&labels.length<31;stamp+=86400000){const day=new Date(stamp).toISOString().slice(0,10);labels.push(day);points.push(orders.filter(order=>eatDate(new Date(order.created_at))===day&&!['requested','cancelled'].includes(order.status)).reduce((sum,order)=>sum+order.total,0));}
 return {labels,points};
}
export function chartTicks(count:number,limit:number){if(count<=limit)return Array.from({length:count},(_,index)=>index);return Array.from({length:limit},(_,index)=>Math.round(index*(count-1)/(limit-1)));}
