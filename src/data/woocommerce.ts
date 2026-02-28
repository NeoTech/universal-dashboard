import { fetchResource } from './api';

export interface WooCommerceOrder {
  id: number;
  status: 'pending' | 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'refunded' | 'failed' | 'trash';
  currency: string;
  date_created: string;
  date_modified: string;
  total: string;
  customer_id: number;
  billing: { first_name: string; last_name: string; email: string; country: string };
  line_items: Array<{ id: number; name: string; quantity: number; subtotal: string; total: string }>;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  total_sales: number;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  stock_quantity: number | null;
  images: Array<{ id: number; src: string; alt: string }>;
}

export function fetchWooCommerceOrders(): Promise<{ orders: WooCommerceOrder[] }> {
  return fetchResource<{ orders: WooCommerceOrder[] }>('/api/woocommerce/orders');
}

export function fetchWooCommerceProducts(): Promise<{ products: WooCommerceProduct[] }> {
  return fetchResource<{ products: WooCommerceProduct[] }>('/api/woocommerce/products');
}
