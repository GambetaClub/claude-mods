import type { On } from 'claude-code'

const END_MIN = 24 * 60

function lastSundayUtc(year: number, month: number) {
  const last = new Date(Date.UTC(year, month + 1, 0, 1))
  return last.getTime() - last.getUTCDay() * 86400000
}

function amsterdam(ms: number) {
  const year = new Date(ms).getUTCFullYear()
  const summer = ms >= lastSundayUtc(year, 2) && ms < lastSundayUtc(year, 9)
  const local = new Date(ms + (summer ? 2 : 1) * 3600000)
  return {
    day: local.toISOString().slice(0, 10),
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  }
}

export function register(on: On) {
  let armedDay = ''

  on('session.start', async ($, e, next) => {
    const tick = async () => {
      const { day, minute } = amsterdam(await $.clock.now())
      if (day === armedDay) return
      try {
        await $.command.run({ command: 'keepwarm', args: `${END_MIN - minute}m` })
        armedDay = day
        $.ui.toast(`Day warm: cache kept warm until midnight`)
      } catch {}
    }
    void tick()
    $.clock.every(60000, tick)
    return next(e)
  })
}
