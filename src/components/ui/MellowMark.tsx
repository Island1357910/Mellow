/** 半糖三色圆标（与 favicon 一致：粉 / 薄荷 / 奶油） */
export function MellowMark(props: { size?: number; className?: string }) {
  const size = props.size ?? 56
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={props.className}
      aria-hidden
    >
      <circle cx="24" cy="30" r="12" fill="#FFB5C5" />
      <circle cx="40" cy="28" r="10" fill="#B5E8D5" />
      <circle cx="34" cy="42" r="8" fill="#FFE5A0" />
    </svg>
  )
}
