import { useAuth } from './useAuth';

export function usePermission() {
  const { user } = useAuth();
  const list = user?.permissions || [];
  return {
    can: (code) => list.includes(code),
    canAny: (...codes) => codes.some((c) => list.includes(c)),
    canAll: (...codes) => codes.every((c) => list.includes(c)),
  };
}