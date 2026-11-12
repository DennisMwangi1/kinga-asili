import { House, ShoppingBag, Plus, Package, UsersRound, FlaskConical, Truck, Menu, ReceiptText, ChartNoAxesCombined, Settings2, type LucideIcon } from 'lucide-react';
const icons: Record<string, LucideIcon> = {
  home: House, orders: ShoppingBag, plus: Plus, stock: Package, people: UsersRound,
  purchases: ReceiptText, bundles: Package, reports: ChartNoAxesCombined, settings: Settings2, batches: FlaskConical, delivery: Truck, more: Menu,
  Overview: House, Orders: ShoppingBag, Production: FlaskConical, Inventory: Package,
  'Purchases & Expenses': ReceiptText, Customers: UsersRound, Deliveries: Truck, Reports: ChartNoAxesCombined, Settings: Settings2,
};
export default function WorkspaceIcon({name,size=20}:{name:string;size?:number}) {
  const Icon=icons[name]||Menu;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true"/>;
}
