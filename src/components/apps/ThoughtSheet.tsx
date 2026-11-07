export function ThoughtSheet(props: { text: string; onClose: () => void }) {
  const body = props.text.trim()
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/25 p-3" onClick={props.onClose}>
      <section className="max-h-[72%] w-full overflow-auto rounded-[24px] bg-[#fffaf6] p-4 shadow-[0_16px_40px_rgba(80,50,60,0.16)]" onClick={(event) => event.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">思维链</h3>
          <button type="button" className="chip" onClick={props.onClose}>关闭</button>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7">{body || '这一轮没有留下思维链。想看的话，到世界书的指令库里打开一种思维链。'}</p>
      </section>
    </div>
  )
}
