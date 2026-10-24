export type Settled = { modelSettled: boolean; sessionModel: string | null }
export type Sent = { model: string; effort: string | null }

declare module 'claude-code' {
  interface PluginState {
    'model-router-slim': { settled: Settled; off: boolean; sent: Sent }
  }
}
