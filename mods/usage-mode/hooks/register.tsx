/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { ContextCategory, EngineInterface, On, SessionRateLimit } from 'claude-code'

const CTX_WIDTH = 10
const LIMIT_WIDTH = 10

type Cell = {
  label: string
  percent: number
  categories?: ContextCategory[]
}

function heatOf(percent: number) {
  if (percent >= 85) return 'error'
  if (percent >= 60) return 'warning'
  return 'success'
}

function timeLeft(resetsAt: string | undefined, now: number) {
  if (!resetsAt) return null
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`
  return `${(ms / 86400000).toFixed(1)}d`
}

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'week',
  spend_limit: 'spend',
}

function segmentsOf(categories: ContextCategory[], width: number) {
  const total = categories.reduce((sum, c) => sum + c.tokens, 0)
  // ponytail: rounding can drift a cell or two; last segment absorbs it
  const cells = categories.map(c => Math.round((c.tokens / total) * width))
  cells[cells.length - 1] = width - cells.slice(0, -1).reduce((a, b) => a + b, 0)
  return cells
}

async function readCells($: EngineInterface): Promise<Cell[]> {
  const now = $.clock.now()
  const { context, rateLimits } = await $.session.usage({ breakdown: 'summary' })
  const cells: Cell[] = []

  const categories = (context.breakdown?.categories ?? []).filter(
    c => c.kind !== 'deferred' && c.tokens > 0,
  )
  const percent = context.breakdown?.percentage ?? context.percent
  if (percent !== undefined) {
    cells.push({ label: 'ctx', percent, categories: categories.length > 0 ? categories : undefined })
  }

  for (const limit of (rateLimits ?? []) as SessionRateLimit[]) {
    if (!(limit.kind in LABELS)) continue
    cells.push({
      label: timeLeft(limit.resetsAt, now) ?? LABELS[limit.kind],
      percent: Math.min(100, Math.max(0, limit.percentUsed)),
    })
  }
  return cells
}

export function register(on: On) {
  let cells: Cell[] = []

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    cells = await readCells($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    cells = await readCells($)
    $.ui.invalidate('ui.render')
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    cells = await readCells($)
    $.ui.invalidate('ui.render')
    return result
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (cells.length === 0) return next(e)
    const { Box, Text } = await $.ui.resolve(e)

    return (
      <Box>
        {e.props.modes.map(mode => (
          <Text dimColor>{`${mode} & `}</Text>
        ))}
        {cells.map((cell, i) => {
          const heat = heatOf(cell.percent)
          const isLoud = cell.percent >= 85
          const segments = cell.categories
            ? segmentsOf(cell.categories, CTX_WIDTH).map((n, k) => ({
                text: (cell.categories![k].kind === 'used' ? '━' : '─').repeat(Math.max(0, n)),
                color: cell.categories![k].color,
                isDim: cell.categories![k].kind !== 'used',
              }))
            : [
                {
                  text: '━'.repeat(Math.round((cell.percent / 100) * LIMIT_WIDTH)),
                  color: heat,
                  isDim: false,
                },
                {
                  text: '─'.repeat(LIMIT_WIDTH - Math.round((cell.percent / 100) * LIMIT_WIDTH)),
                  color: undefined,
                  isDim: true,
                },
              ]
          return (
            <Box>
              <Text dimColor>{`${i > 0 ? ' · ' : ''}${cell.label} `}</Text>
              {segments.map(segment => (
                <Text color={segment.color} dimColor={segment.isDim}>
                  {segment.text}
                </Text>
              ))}
              <Text color={heat} bold={isLoud}>{` ${Math.round(cell.percent)}%`}</Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
