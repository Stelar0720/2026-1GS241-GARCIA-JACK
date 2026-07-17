import { getApiUrl } from "./env";
import { getApiErrorMessage, type ApiErrorBody } from "./api-error";
import type { Product } from "./catalog";

export type Review = {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, init);
  const body = (await response.json().catch(() => null)) as ({ data?: T } & ApiErrorBody) | null;
  if (!response.ok) throw new Error(getApiErrorMessage(body, "No se pudo completar la solicitud."));
  return body?.data as T;
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

export const commerceApi = {
  getWishlist: async (userId: string, token: string) => {
    const products = await request<Product[]>(`/customers/${encodeURIComponent(userId)}/wishlist`, { headers: authHeaders(token) });
    return { productIds: products.map((product) => product.id) };
  },
  addWishlist: (userId: string, productId: string, token: string) =>
    request<Product[]>(`/customers/${encodeURIComponent(userId)}/wishlist/${encodeURIComponent(productId)}`, {
      method: "POST", headers: authHeaders(token), body: JSON.stringify({ productId }),
    }).then((products) => ({ productIds: products.map((product) => product.id) })),
  removeWishlist: (userId: string, productId: string, token: string) =>
    request<void>(`/customers/${encodeURIComponent(userId)}/wishlist/${encodeURIComponent(productId)}`, {
      method: "DELETE", headers: authHeaders(token),
    }),
  getReviews: (productId: string) => request<Review[]>(`/products/${encodeURIComponent(productId)}/reviews`),
  createReview: (productId: string, values: { rating: number; comment: string }, token: string) =>
    request<Review>(`/products/${encodeURIComponent(productId)}/reviews`, {
      method: "POST", headers: authHeaders(token), body: JSON.stringify(values),
    }),
  validateCoupon: (code: string, subtotalUsd: number) =>
    request<{ code: string; discountUsd: number; totalUsd: number }>("/coupons/validate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, subtotalUsd }),
    }),
};
