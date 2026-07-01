import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateISBN13(): string {
  const prefix = "978";
  const group = "1"; // English
  const publisher = Math.floor(100 + Math.random() * 900).toString();
  const title = Math.floor(10000 + Math.random() * 90000).toString();
  
  const base = prefix + group + publisher + title; // 12 digits
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base[i]);
    sum += (i % 2 === 0) ? digit * 1 : digit * 3;
  }
  const remainder = sum % 10;
  const checksum = (10 - remainder) % 10;
  
  return `${prefix}-${group}-${publisher}-${title}-${checksum}`;
}
