interface LoadingProps {
  text?: string;
  small?: boolean;
}

export default function Loading({ text = '加载中...', small = false }: LoadingProps) {
  if (small) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#536471]">
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1d9bf0] [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1d9bf0] [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1d9bf0]" />
        </span>
        {text}
      </span>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-white text-[#0f1419]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#eff3f4]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#1d9bf0] border-t-transparent" />
      </div>
      <p className="text-sm text-[#536471]">{text}</p>
    </div>
  );
}
