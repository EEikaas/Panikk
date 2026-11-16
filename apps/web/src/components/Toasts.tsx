import { create } from 'zustand';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

let seq = 0;
export const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3200): void {
  const id = ++seq;
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
  setTimeout(() => useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
