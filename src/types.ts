export type Product = { id: string; categoryId: string; name: string; priceCents: number; image: string; available: boolean; order: number };
export type Category = { id: string; name: string; order: number; column: number; image: string };
export type Season = 'none' | 'auto' | 'autumn' | 'winter' | 'spring' | 'summer';
export type Settings = { brandName: string; tagline: string; accent: string; background: string; textColor: string; logo: string; tvBackground: string; tvScale: number; tvOrientation: 'portrait' | 'landscape'; tvRotation: 0 | 90 | 180 | 270; season: Season; adsEnabled: boolean; adIntervalSeconds: number; adDurationSeconds: number; promotionIds: string[]; promotionText: string; promotionLabel: string; currency: string; timezone: string };
export type MenuState = { products: Product[]; categories: Category[]; settings: Settings };
export type Language = 'ar' | 'fr';
