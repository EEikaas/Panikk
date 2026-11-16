import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Minimal klientruter (ingen ekstra avhengighet).
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener('popstate', notify);

export function navigate(to: string, replace = false): void {
  if (to === location.pathname + location.search) return;
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.scrollTo(0, 0);
  notify();
}

export function usePath(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => location.pathname,
  );
}

export function useQuery(): URLSearchParams {
  usePath();
  return new URLSearchParams(location.search);
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    />
  );
}
