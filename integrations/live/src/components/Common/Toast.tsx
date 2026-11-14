import { useToastStore } from '../../stores/useToastStore';

export default function Toast() {
  const message = useToastStore((s) => s.message);
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[120] max-w-[85vw] -translate-x-1/2 rounded-2xl bg-black/78 px-4 py-2.5 text-center text-xs leading-relaxed text-white shadow-lg">
      {message}
    </div>
  );
}
