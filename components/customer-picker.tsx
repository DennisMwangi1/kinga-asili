'use client';
import {useId} from 'react';
import {Combobox} from '@base-ui/react/combobox';
import {ChevronDown,Check,X} from 'lucide-react';
import type {RecordRow} from '@/lib/domain';
import {customerMatches} from '@/lib/order-entry';
import {customerPhone} from '@/lib/customer-validation';
export default function CustomerPicker({customers,value,onChange,disabled}:{customers:RecordRow[];value:string;onChange:(customer?:RecordRow)=>void;disabled:boolean}){
 const id=useId();
 const items=[{id:'new',name:'New customer'},...customers];
 return <div className="customer-picker"><label htmlFor={id}>Existing customer (optional)</label><Combobox.Root<RecordRow> items={items} value={items.find(item=>item.id===value)||items[0]} onValueChange={item=>onChange(customers.find(customer=>customer.id===item?.id))} itemToStringLabel={item=>String(item.name)} itemToStringValue={item=>String(item.id)} isItemEqualToValue={(item,selected)=>item.id===selected.id} filter={customerMatches} disabled={disabled} autoHighlight><div className="customer-picker-control"><Combobox.Input id={id} placeholder="Search by name, phone or area…" autoComplete="off"/><Combobox.Clear className="customer-picker-clear" aria-label="Clear customer selection"><X size={16}/></Combobox.Clear><Combobox.Trigger className="customer-picker-trigger" aria-label="Show customers"><ChevronDown size={18}/></Combobox.Trigger></div><Combobox.Portal><Combobox.Positioner className="customer-picker-positioner" sideOffset={6} align="start"><Combobox.Popup className="customer-picker-popup"><Combobox.Empty className="customer-picker-empty">No matching customers.</Combobox.Empty><Combobox.List>{(item:RecordRow)=><Combobox.Item key={String(item.id)} value={item} className="customer-picker-item"><span><strong>{String(item.name)}</strong>{item.id!=='new'&&<small>{[customerPhone(String(item.phone||''))||'Phone not added',item.location].filter(Boolean).join(' · ')}</small>}</span><Combobox.ItemIndicator><Check size={18}/></Combobox.ItemIndicator></Combobox.Item>}</Combobox.List></Combobox.Popup></Combobox.Positioner></Combobox.Portal></Combobox.Root><small className="form-help">Search and select to fill contact and delivery details.</small></div>;
}
