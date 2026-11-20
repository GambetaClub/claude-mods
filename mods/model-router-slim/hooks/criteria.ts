// The one place model choice is defined: the model router reads it, and so does every skill that spawns agents.
// Pick the cheapest tier whose `when` fits. `effort.hard` applies when the task has to understand or weigh things, or is risky.
export const MODEL_CRITERIA = {
  fast: {
    model: 'haiku',
    effort: { easy: 'low', hard: 'low' },
    when: 'Simple, cost-sensitive work with one short answer: a single read-only lookup (list one directory, grep for one string and list the files that contain it, read one file, fetch one web page, run one read-only command), or summarizing, classifying or labelling a short text. Any change to a file, or a search that must report each usage with its line or context, is not this tier. If in doubt, it is not this tier.',
  },
  balanced: {
    model: 'sonnet',
    effort: { easy: 'low', hard: 'medium' },
    when: 'Well-scoped work where what done looks like fits in one sentence and speed matters: fix a bug that has a clear reproduction, upgrade one package and fix its tests, a small change fully specified in a few files, replace a text or rename something, drive a browser through known flows, run scripted database checks, or verify a scoped review fix. Also scanning: find every usage of something across the codebase and report each one with its line or context, browse, scrape or gather information, summarize what was found.',
  },
  deep: {
    model: 'opus',
    effort: { easy: 'medium', hard: 'medium' },
    when: 'The default for complex coding and knowledge work: a feature that touches several layers (data model, API, UI), debugging without a clear reproduction, refactors, a purely additive migration (a nullable column, a new table, an index), review requiring judgment about architecture or data integrity, planning, design, writing UI, orchestrating work across many modules or subagents.',
  },
  superDeep: {
    model: 'fable',
    effort: { easy: 'medium', hard: 'medium' },
    when: 'Only for the orchestrator itself (the session that plans the work and reviews what comes back), never for a subagent it spawns. Ambitious or high-stakes work where judgment and accuracy are paramount: a large, loosely defined, open-ended goal across the whole codebase with many milestones and undocumented decisions (a new architecture, a framework major-version migration); security (vulnerability research, exploit analysis, threat modelling, review of auth or permissions code); anything that could lose or corrupt data, including a destructive migration (drop or rename a column or table, add NOT NULL, a backfill or data migration); changes to production data or infrastructure. A purely additive migration (a nullable column, a new table, an index) is not this tier, however it ships. If in doubt, it is not this tier.',
  },
} as const

export const MODEL_RULES = [
  'Pass both `model` and `effort` on every Agent call you pick for; omit both only to let the router decide.',
  'In doubt between two tiers, take the cheaper one, except for superDeep subjects.',
  'A spawned subagent carrying out work an orchestrator already planned gets Opus (deep) at most, superDeep subjects included (data loss, destructive migrations, security): the orchestrator reviews its work. Fable is for the orchestrator itself, when it plans such work.',
  'A lead on a big job (Fable or Opus) hands its well-scoped parts to Sonnet subagents.',
  'If a result falls short, raise effort before changing model, but never set Opus to `high` or above.',
  'Never let a subagent inherit Fable by accident. Forks always inherit.',
] as const
