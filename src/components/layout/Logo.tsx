export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[8px] ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, #2a2540 0%, #15141c 70%)',
        boxShadow: '0 1px 0 0 rgb(255 255 255 / 0.08) inset, 0 4px 14px -6px rgb(139 124 246 / 0.6)',
      }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M3 17.5 8 7.5l4 7 3-4.5 6 7.5" stroke="#b6aaff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="15" cy="10" r="1.9" fill="#e4dfff" />
      </svg>
    </span>
  )
}
