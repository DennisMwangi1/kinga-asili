import type {Role} from './domain';
export interface WorkspaceDestination {label:string;href:string;icon:string;}
export interface CreationAction {id:string;label:string;icon:string;description:string;roles:readonly Role[];}
export const creationActions:CreationAction[]=[
 {id:'order',label:'New order',icon:'orders',description:'Create a customer request',roles:['admin','sales','cashier']},
 {id:'customer',label:'Customer',icon:'people',description:'Add contact and delivery details',roles:['admin','sales','cashier']},
 {id:'batch',label:'Production batch',icon:'batches',description:'Record ingredients and bottled output',roles:['admin','stock_keeper']},
 {id:'purchase',label:'Material receipt',icon:'stock',description:'Record a supplier purchase',roles:['admin','stock_keeper','cashier']},
 {id:'expense',label:'Expense',icon:'purchases',description:'Record an operating cost',roles:['admin','stock_keeper','cashier']},
 {id:'material',label:'Stock material',icon:'stock',description:'Add an ingredient or packaging item',roles:['admin','stock_keeper']},
 {id:'product',label:'Catalogue product',icon:'stock',description:'Add a storefront bottle variant',roles:['admin']},
 {id:'bundle',label:'Product bundle',icon:'bundles',description:'Configure a bottle pack',roles:['admin']},
];
export const availableCreationActions=(role:Role)=>creationActions.filter(action=>action.roles.includes(role));
export const settingsSections:WorkspaceDestination[]=[
 {label:'Catalogue & prices',href:'/dashboard/settings/catalogue',icon:'stock'},
 {label:'Bundles',href:'/dashboard/settings/bundles',icon:'bundles'},
 {label:'Staff access',href:'/dashboard/settings/staff',icon:'people'},
 {label:'Audit trail',href:'/dashboard/settings/audit',icon:'reports'},
 {label:'Connections',href:'/dashboard/settings/connections',icon:'settings'},
];
export const inventorySections:WorkspaceDestination[]=[
 {label:'Finished bottles',href:'/dashboard/inventory/finished',icon:'stock'},
 {label:'Ingredients',href:'/dashboard/inventory/ingredient',icon:'batches'},
 {label:'Packaging',href:'/dashboard/inventory/packaging',icon:'stock'},
 {label:'Batch stock',href:'/dashboard/inventory/lots',icon:'batches'},
 {label:'Stock movements',href:'/dashboard/inventory/movements',icon:'reports'},
];
export function moduleSections(module:string):WorkspaceDestination[]{return module==='settings'?settingsSections:module==='inventory'?inventorySections:[];}
const pins:Record<Role,WorkspaceDestination[]>={
 admin:[{label:'Home',href:'/dashboard',icon:'home'},{label:'Orders',href:'/dashboard/orders',icon:'orders'},{label:'Stock',href:'/dashboard/inventory',icon:'stock'}],
 sales:[{label:'Orders',href:'/dashboard/orders',icon:'orders'},{label:'Customers',href:'/dashboard/customers',icon:'people'}],
 cashier:[{label:'Orders',href:'/dashboard/orders',icon:'orders'},{label:'Stock',href:'/dashboard/inventory',icon:'stock'},{label:'Purchases',href:'/dashboard/purchases',icon:'purchases'}],
 stock_keeper:[{label:'Stock',href:'/dashboard/inventory',icon:'stock'},{label:'Production',href:'/dashboard/production',icon:'batches'},{label:'Purchases',href:'/dashboard/purchases',icon:'purchases'}],
 driver:[],
};
/** Andishi's contextual dock: expose the active module without changing default pins. */
export function contextualTabs(role:Role,current?:WorkspaceDestination):WorkspaceDestination[]{
 const visible=[...pins[role]];
 if(!current||visible.some(item=>item.href===current.href))return visible;
 return visible.length>=3?[...visible.slice(0,-1),current]:[...visible,current];
}
