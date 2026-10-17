import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { initialMenu, supabase, validateMenu } from './lib';
import type { MenuState } from './types';

type Store = {
  menu: MenuState;
  status: 'preview' | 'connecting' | 'live' | 'offline';
  revision: number;
  reload: () => Promise<void>;
  publish: (menu: MenuState, revision: number) => Promise<void>;
};
const Context = createContext<Store | null>(null);
const CACHE = 'blanco-menu-v1';
function cachedMenu() {
  // An unconfigured app is a read-only preview. Production cache never becomes its data source.
  if (!supabase) return initialMenu;
  try {
    const value = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (validateMenu(value)) return value;
  } catch {
    /* Use bundled original when storage is unavailable. */
  }
  return initialMenu;
}
export function MenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState>(cachedMenu);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Store['status']>(supabase ? 'connecting' : 'preview');
  const reload = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('menu_state')
      .select('content,revision')
      .eq('id', 'blanco')
      .single();
    if (error || !validateMenu(data?.content)) {
      setStatus('offline');
      return;
    }
    setMenu(data.content);
    setRevision(data.revision);
    setStatus('live');
    try {
      localStorage.setItem(CACHE, JSON.stringify(data.content));
    } catch {
      /* TV storage can be disabled. */
    }
  }, []);
  useEffect(() => {
    void reload();
    if (!supabase) return;
    const channel = supabase
      .channel('blanco-menu')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menu_state', filter: 'id=eq.blanco' },
        () => {
          void reload();
        },
      )
      .subscribe();
    const interval = window.setInterval(() => {
      void reload();
    }, 30000);
    const online = () => {
      void reload();
    };
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    return () => {
      if (supabase) void supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', online);
    };
  }, [reload]);
  const publish = async (next: MenuState, expected: number) => {
    if (!supabase) throw new Error('Supabase غير مربوط / Supabase non configuré');
    if (!validateMenu(next))
      throw new Error('راجع الحقول والتوقيت / Vérifiez les champs et les durées');
    const { data, error } = await supabase
      .from('menu_state')
      .update({ content: next, revision: expected + 1 })
      .eq('id', 'blanco')
      .eq('revision', expected)
      .select('revision')
      .single();
    if (error || !data)
      throw new Error(
        'تعذّر الحفظ، تأكد من الصلاحيات وحدّث البيانات / Échec : vérifiez vos droits et rechargez les données.',
      );
    await reload();
  };
  return (
    <Context.Provider value={{ menu, status, revision, reload, publish }}>
      {children}
    </Context.Provider>
  );
}
export function useMenu() {
  const value = useContext(Context);
  if (!value) throw new Error('MenuProvider required');
  return value;
}
