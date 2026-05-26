import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateDeviceHash(): string {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const screen = typeof screen !== 'undefined' ? screen : null;
  
  const components = [
    nav?.language || 'unknown',
    nav?.platform || 'unknown',
    screen?.width || 0,
    screen?.height || 0,
    screen?.colorDepth || 0
  ];
  
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
