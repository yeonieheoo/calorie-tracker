// Lightweight, dependency-free SVG line chart used for the weight trend and
// the net-kcal trend on the 진행 tab. `data` is [{ label: 'YYYY-MM-DD', value: number }].
// `referenceValue`, if given, draws a dashed horizontal goal/target line.
export default function TrendChart({ data = [], color = '#B85C38', height = 100, referenceValue }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-xs text-[#9B8D7E]" style={{ height }}>
        아직 기록이 없어
      </div>
    )
  }

  const values = data.map((d) => d.value)
  const allValues = referenceValue != null ? [...values, referenceValue] : values
  let min = Math.min(...allValues)
  let max = Math.max(...allValues)
  if (min === max) {
    min -= 1
    max += 1
  }

  const w = 300
  const pad = 6
  const xFor = (i) => (data.length === 1 ? w / 2 : pad + (i / (data.length - 1)) * (w - pad * 2))
  const yFor = (v) => height - pad - ((v - min) / (max - min)) * (height - pad * 2)

  const points = data.map((d, i) => `${xFor(i)},${yFor(d.value)}`)
  const pathD = `M${points.join(' L')}`
  const refY = referenceValue != null ? yFor(referenceValue) : null

  const formatLabel = (dateStr) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
  }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {refY != null && (
          <line x1={0} x2={w} y1={refY} y2={refY} stroke="#D8CDB8" strokeDasharray="4,3" strokeWidth="1" />
        )}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const [x, y] = p.split(',')
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-[#9B8D7E] mt-1.5 tabular">
        <span>{formatLabel(data[0].label)}</span>
        <span>{formatLabel(data[data.length - 1].label)}</span>
      </div>
    </div>
  )
}
