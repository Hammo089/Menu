export type TVLoyaltySettings = {
  enabled: boolean;
  qrVisible: boolean;
  eyebrow: string;
  title: string;
  description: string;
  footnote: string;
  url: string;
  position: 'top' | 'bottom';
  qrSide: 'left' | 'right';
  height: number;
  qrScale: number;
  textScale: number;
  background: string;
  textColor: string;
  borderColor: string;
  qrColor: string;
};
export const defaultTVLoyalty: TVLoyaltySettings = {
  enabled: true,
  qrVisible: true,
  eyebrow: 'LE CLUB BLANCO',
  title: 'Votre fidélité récompensée.',
  description: 'Scannez ici pour créer votre carte de fidélité.',
  footnote: 'Cumulez des tampons · Profitez de cadeaux',
  url: '',
  position: 'bottom',
  qrSide: 'left',
  height: 12,
  qrScale: 100,
  textScale: 100,
  background: '#f4f0e8',
  textColor: '#292723',
  borderColor: '#cfc6b7',
  qrColor: '#23211f',
};
export const tvLoyaltySettings = (value?: Partial<TVLoyaltySettings>): TVLoyaltySettings => ({
  ...defaultTVLoyalty,
  ...value,
});
export function validTVLoyaltyUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !/\s/.test(value)
    );
  } catch {
    return false;
  }
}
export function validTVLoyalty(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as TVLoyaltySettings;
  return (
    typeof v.enabled === 'boolean' &&
    typeof v.qrVisible === 'boolean' &&
    ['eyebrow', 'title', 'description', 'footnote'].every(
      (k) =>
        typeof v[k as keyof TVLoyaltySettings] === 'string' &&
        String(v[k as keyof TVLoyaltySettings]).length <= 160,
    ) &&
    typeof v.url === 'string' &&
    v.url.length <= 500 &&
    validTVLoyaltyUrl(v.url) &&
    ['top', 'bottom'].includes(v.position) &&
    ['left', 'right'].includes(v.qrSide) &&
    Number.isFinite(v.height) &&
    v.height >= 10 &&
    v.height <= 24 &&
    Number.isFinite(v.qrScale) &&
    v.qrScale >= 60 &&
    v.qrScale <= 110 &&
    Number.isFinite(v.textScale) &&
    v.textScale >= 70 &&
    v.textScale <= 140 &&
    ['background', 'textColor', 'borderColor', 'qrColor'].every((k) =>
      /^#[0-9a-f]{6}$/i.test(String(v[k as keyof TVLoyaltySettings])),
    )
  );
}
