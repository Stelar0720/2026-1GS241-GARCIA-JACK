import { getApiUrl } from "./env";

export type Product = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  tag: string;
  category?: string;
  tags?: string[];
  details?: {
    level: string;
    light: string;
    space: string;
    harvest: string;
    cycles: string;
    includes: string[];
    steps: { title: string; text: string }[];
    testimonial: { name: string; text: string };
  };
  imageUrl: string;
  active: number;
  stock: number;
  minimumStock: number;
  inventoryUpdatedAt?: string | null;
};

// Productos de respaldo cuando la API no está disponible.
export const fallbackProducts: Product[] = [
  {
    id: "kit-balcon-basico",
    name: "Kit balcón básico",
    description: "Lechuga, cilantro y cebollín para espacios con 2-3 horas de luz.",
    priceUsd: 24.9,
    category: "Hortalizas",
    tags: ["Principiantes", "Balcon"],
    tag: "Inicio",
    imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop",
    active: 1,
    stock: 0,
    minimumStock: 0,
    inventoryUpdatedAt: null,
  },
  {
    id: "kit-microverde-rapido",
    name: "Kit microverde rápido",
    description: "Microbrotes listos en 7-10 días, ideal para cocinas en apartamentos.",
    priceUsd: 29.9,
    category: "Microverdes",
    tags: ["Cosecha rapida", "Interior"],
    tag: "Más vendido",
    imageUrl: "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400&h=300&fit=crop",
    active: 1,
    stock: 0,
    minimumStock: 0,
    inventoryUpdatedAt: null,
  },
  {
    id: "kit-aromaticas-compacto",
    name: "Kit aromáticas compacto",
    description: "Albahaca, menta y perejil con guía de poda y riego urbano.",
    priceUsd: 34.9,
    category: "Aromaticas",
    tags: ["Cocina", "Compacto"],
    tag: "Premium",
    imageUrl: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=300&fit=crop",
    active: 1,
    stock: 0,
    minimumStock: 0,
    inventoryUpdatedAt: null,
  },
];

export const productsById = Object.fromEntries(fallbackProducts.map((p) => [p.id, p]));

// Fetch products from API (returns only active products)
export async function fetchProductsFromApi(): Promise<Product[]> {
  const apiUrl = getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/products`, { cache: "no-store" });
    if (!response.ok) {
      console.warn("Failed to fetch products from API, using fallback");
      return fallbackProducts;
    }
    const data = (await response.json()) as { data: Product[] };
    return data.data.filter((p) => p.active === 1);
  } catch (error) {
    console.warn("API unavailable, using fallback products:", error);
    return fallbackProducts;
  }
}
