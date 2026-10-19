export type Settled = { modelSettled: boolean; sessionModel: string | null }

declare module 'claude-code' {
  interface PluginState {
    'model-router': { settled: Settled }
  }
}
