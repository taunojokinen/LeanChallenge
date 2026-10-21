import { formatReportValue } from '../../entities/report/model.js'

const WIDTH = 720
const HEIGHT = 380
const LEFT = 100
const RIGHT = 25
const TOP = 25
const BOTTOM = 65

function ReportLineChart({ series, metric, totalRounds }) {
  const points = series.filter((entry) => entry[metric.key] !== null)
  const values = points.map((entry) => entry[metric.key])
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(metric.key === 'knl' ? 100 : 0, ...values)
  const padding = (maximum - minimum || 1) * 0.08
  const low = minimum < 0 ? minimum - padding : 0
  const high = metric.key === 'knl' ? maximum : maximum + padding
  const x = (round) => LEFT + (round - 1) / Math.max(1, totalRounds - 1) * (WIDTH - LEFT - RIGHT)
  const y = (value) => TOP + (high - value) / (high - low) * (HEIGHT - TOP - BOTTOM)
  const ticks = Array.from({ length: 5 }, (_, index) => low + (high - low) * index / 4)
  const path = points.map((entry, index) => {
    const command = points[index - 1]?.round === entry.round - 1 ? 'L' : 'M'
    return `${command}${x(entry.round)},${y(entry[metric.key])}`
  }).join(' ')

  return (
    <svg className="report-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${metric.label}, vahvistetut kierrokset`}>
      <title>{metric.label}</title>
      <desc>Vain vahvistetut kierrokset. Tarkat arvot ovat raportin kierrostietotaulukossa.</desc>
      {ticks.map((tick, index) => (
        <g key={index} className="report-chart__grid">
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} />
          <text x={LEFT - 12} y={y(tick)} textAnchor="end" dominantBaseline="middle">
            {tick.toLocaleString('fi-FI', { notation: 'compact', maximumFractionDigits: 1 })}
          </text>
        </g>
      ))}
      <line className="report-chart__zero" aria-label="Nollataso" x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} />
      {Array.from({ length: totalRounds }, (_, index) => index + 1).map((round) => (
        <text className="report-chart__round" key={round} x={x(round)} y={HEIGHT - BOTTOM + 25} textAnchor="middle">{round}</text>
      ))}
      <text className="report-chart__round" x={(LEFT + WIDTH - RIGHT) / 2} y={HEIGHT - 10} textAnchor="middle">Kierros</text>
      <path className="report-chart__line" d={path} />
      {points.map((entry) => (
        <circle className="report-chart__point" key={entry.round} cx={x(entry.round)} cy={y(entry[metric.key])} r="4">
          <title>{`Kierros ${entry.round}: ${formatReportValue(entry[metric.key], metric.unit)}`}</title>
        </circle>
      ))}
      {points.length === 0 ? <text className="report-chart__round" x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle">Ei vahvistettuja arvoja</text> : null}
    </svg>
  )
}

export default ReportLineChart
