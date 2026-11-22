import { supabase } from '../lib';
export async function personnel(action: string, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Connexion au serveur indisponible.');
  const { data, error } = await supabase.rpc('personnel_api', { action, payload });
  if (error || data?.error) throw new Error(error?.message || data.error);
  return data;
}
export const randomKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
