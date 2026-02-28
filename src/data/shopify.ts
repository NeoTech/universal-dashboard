import { fetchResource } from './api';

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
  total_price: string;
  currency: string;
  financial_status: 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';
  fulfillment_status: 'fulfilled' | 'null' | 'partial' | 'restocked' | null;
  customer?: { id: number; first_name: string; last_name: string; email: string };
  line_items: Array<{ id: number; title: string; quantity: number; price: string }>;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  status: 'active' | 'archived' | 'draft';
  vendor: string;
  product_type: string;
  created_at: string;
  published_at: string | null;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    inventory_quantity: number;
    inventory_policy: string;
  }>;
  images: Array<{ id: number; src: string; alt: string | null }>;
}

export function fetchShopifyOrders(): Promise<{ orders: ShopifyOrder[] }> {
  return fetchResource<{ orders: ShopifyOrder[] }>('/api/shopify/orders');
}

export function fetchShopifyProducts(): Promise<{ products: ShopifyProduct[] }> {
  return fetchResource<{ products: ShopifyProduct[] }>('/api/shopify/products');
}
