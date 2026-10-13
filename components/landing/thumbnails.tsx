/**
 * Small illustrations for the "Inside a saved plan" cards. Each one is a
 * stylised version of a real screen, not live data, so they are decorative:
 * the card's own heading and body carry the meaning for screen readers.
 */

const wrap = 'size-full overflow-hidden rounded-md'

export function MapThumb() {
  return (
    <svg aria-hidden viewBox="0 0 160 88" className={`${wrap} bg-[#efece6] dark:bg-neutral-800`}>
      <path d="M -5 62 Q 40 52 78 58 T 165 40" fill="none" stroke="#d6d1c7" strokeWidth={3} className="dark:stroke-neutral-700" />
      <path d="M 70 50 Q 28 28 48 18 T 104 26 Q 124 44 96 56 T 70 50" fill="none" stroke="#7c3aed" strokeWidth={1.6} />
      <path d="M 74 48 Q 110 30 132 46 T 112 70" fill="none" stroke="#2563eb" strokeWidth={1.6} />
      <rect x={64} y={42} width={18} height={11} rx={3} fill="#0a0a0a" />
      <text x={73} y={50} textAnchor="middle" fontSize={6} fontWeight={700} fill="white" fontFamily="ui-monospace, monospace">HQ</text>
    </svg>
  )
}

export function TimelineThumb() {
  const bars = [
    { x: 10, y: 14, w: 16, color: '#9333ea' },
    { x: 34, y: 14, w: 10, color: '#c084fc' },
    { x: 52, y: 14, w: 16, color: '#9333ea' },
    { x: 76, y: 14, w: 12, color: '#d4d4d8' },
    { x: 22, y: 36, w: 14, color: '#2563eb' },
    { x: 46, y: 36, w: 14, color: '#2563eb' },
  ]
  return (
    <svg aria-hidden viewBox="0 0 160 88" className={`${wrap} bg-transparent`}>
      {bars.map((bar) => <rect key={`${bar.x}-${bar.y}`} x={bar.x} y={bar.y} width={bar.w} height={9} rx={2.5} fill={bar.color} />)}
      <line x1={6} y1={62} x2={150} y2={62} stroke="currentColor" strokeOpacity={0.15} />
      {['08', '11', '14', '17'].map((label, i) => (
        <text key={label} x={10 + i * 44} y={74} fontSize={7} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">{label}</text>
      ))}
    </svg>
  )
}

export function NotScheduledThumb() {
  return (
    <div aria-hidden className={`${wrap} flex flex-col gap-1.5 border bg-card p-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-semibold">Not scheduled</span>
        <span className="text-[7px] text-muted-foreground">1 group</span>
      </div>
      <div className="rounded border bg-muted/50 p-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-medium">[GROUP NAME]</span>
          <span className="rounded-full bg-muted px-1 text-[6px] text-muted-foreground">Low</span>
        </div>
        <p className="mt-0.5 text-[6px] leading-snug text-muted-foreground">Window closes before any officer can arrive</p>
      </div>
    </div>
  )
}

export function CsvThumb() {
  const rows = [['Anil', '1', '11:30', '7.9'], ['Anil', '2', '13:00', '2.2'], ['Rahul', '1', '11:00', '12.8'], ['Priya', '2', '14:14', '2.1']]
  return (
    <div aria-hidden className={`${wrap} border bg-card p-1.5 font-mono text-[6px] leading-relaxed`}>
      <div className="grid grid-cols-4 gap-1 border-b pb-1 text-muted-foreground">
        {['Officer', 'Stop', 'Start', 'km'].map((head) => <span key={head}>{head}</span>)}
      </div>
      {rows.map((row) => (
        <div key={row.join()} className="grid grid-cols-4 gap-1 pt-1">
          {row.map((cell, i) => <span key={i}>{cell}</span>)}
        </div>
      ))}
    </div>
  )
}
