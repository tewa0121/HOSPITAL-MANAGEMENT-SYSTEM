import { Loader2 } from 'lucide-react';

export default function Spinner({ full = false }) {
  const icon = <Loader2 className="h-8 w-8 animate-spin text-teal-600" />;
  return full
    ? <div className="flex min-h-screen items-center justify-center">{icon}</div>
    : <div className="flex justify-center p-8">{icon}</div>;
}