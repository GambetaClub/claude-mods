# Claude mods

Three small [Claude Code](https://code.claude.com) mods that make the session cheaper to run and easier to read. Install them one by one; each works alone.

| Mod | What it does |
|---|---|
| [`model-router-slim`](#model-router-slim) | Picks the model and reasoning effort for every prompt with TypeSafe's Jev |
| [`usage-mode`](#usage-mode) | Shows the context window and the 5-hour and weekly limits as bars under the prompt |
| [`cache-tax-slim`](#cache-tax-slim) | Keeps the one-hour prompt cache warm, warns before a cold send, and draws a status band above the prompt |

## Install

You need Claude Code 2.1.287 or newer. On an older version, start it with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude`.

At the prompt of a Claude Code session, one line per mod:

```
/plugin install model-router-slim --marketplace GambetaClub/claude-mods
/plugin install usage-mode --marketplace GambetaClub/claude-mods
/plugin install cache-tax-slim --marketplace GambetaClub/claude-mods
```

From a shell, all three at once:

```sh
for m in model-router-slim usage-mode cache-tax-slim; do
  claude plugin install $m --marketplace GambetaClub/claude-mods
done
```

The first install asks you to add the marketplace (`y`), then for a scope. After that, `/reload-plugins` picks up updates.

To run a mod straight from a clone, point Claude Code at its folder:

```sh
git clone https://github.com/GambetaClub/claude-mods
claude --plugin-dir ./claude-mods/mods/usage-mode
```

`model-router-slim` is the repo root, so for it use `--plugin-dir ./claude-mods`.

## What you'll see

```
router on · sonnet 5.5 · medium     cache warm     main [-]      <- cache-tax-slim band
ctx ━━━━━━────  9% · 5h ━━──── 18% · week ━━━━━━━━ 80%          <- usage-mode
```

The band's `router on · …` label only appears with `model-router-slim` installed: it reads the state that mod publishes. Without it the band shows the cache and the branch.

## model-router-slim

Picks the model and reasoning effort for every prompt. It asks [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe's small decision model, how hard the task is, then sends the turn to the model that fits.

Forked from `jev-model-router` in [claude-code-templates](https://github.com/davila7/claude-code-templates).

| Tier | Model | For |
|---|---|---|
| `fast` | Haiku 5.5 | Small, mechanical work: read a file, rename a symbol |
| `balanced` | Sonnet 5.5 | Everyday changes across a few files |
| `deep` | Opus 5.5 | Design, unknown bugs, security, migrations |
| `superDeep` | Fable 5.1 | Big refactors and features that span many files |

- It sets the effort for each prompt: `low`, `medium`, `high` or `xhigh`.
- It picks the main model on the first turn and keeps it until `/clear` or a compaction. Switching models mid-chat would throw away the prompt cache.
- Each subagent gets its own model. Subagents start fresh, so a different model costs nothing there.
- When a prompt has nothing to do with the current chat, the mod holds it back and suggests a new session, with a ready-to-paste `claude --model … '<prompt>'` command. Send the prompt again to run it in the current chat.
- A task that would change production, move money or destroy data gets at least `deep` and `high` effort.

`/model` and the model's own answer keep naming your session model, because the mod changes each request, not the setting. To see which model really answered:

```sh
jq -r 'select(.type=="assistant") | .message.model' ~/.claude/projects/<project>/<session>.jsonl | uniq -c
```

### Setup

Add this to `~/.claude/settings.json` (user settings, not project settings). The key is `<plugin>@<marketplace>`:

```json
{
  "pluginConfigs": {
    "model-router-slim@claude-mods": {
      "options": { "typesafeApiKey": "…", "timeoutMs": 2000 }
    }
  }
}
```

With no key, the mod falls back to Claude Code's built-in classifier (Haiku). It works, but the classifier only sees the tier names, gives no confidence score, never moves you to a smaller model, and can't do the new-task check.

### Options

| Option | Default | What it does |
|---|---|---|
| `typesafeApiKey` / `gatewayApiKey` | none | Jev through TypeSafe (preferred, gives confidence) or the Vercel AI Gateway |
| `provider` | `auto` | `auto` picks TypeSafe when its key is set, then the Gateway, then the built-in classifier |
| `fastModel`, `balancedModel`, `deepModel`, `superDeepModel` | `haiku`, `sonnet`, `opus`, `fable` | Alias or full model id per tier |
| `routeMainModel` | `true` | Pick the main chat's model from its first prompt |
| `routeMainEffort` | `true` | Pick the main chat's effort |
| `routeSubagentModel` | `true` | Pick each subagent's model |
| `minUpgradeConfidence` / `minDowngradeConfidence` | `0.3` / `0.6` | How sure Jev must be to move up or down |
| `timeoutMs` | `800` | Wait limit per classification; `2000` avoids timeouts on the first call |
| `logDecisions` | `true` | Show the log lines below |
| `typesafeBaseUrl`, `typesafeModel`, `gatewayBaseUrl`, `gatewayModel` | empty | Override the backend endpoints and decision models |

With logging on you get lines like:

```
[Jev Model Router] jev: tier fast (0.99) · effort 0.0 → low (1.00) · risky 0.07 · 396ms
[Jev Model Router] main loop → claude-haiku-5-5, effort low: fast (confidence 0.99)
```

The mod adds no row under the prompt. It publishes whether it is on or off as `$.state` `model-router-slim.off`, and the model and effort it last sent as `model-router-slim.sent`, so another mod (like `cache-tax-slim`) can show them.

### Privacy

With a key set, your prompt goes to TypeSafe or Vercel, along with up to five earlier prompts (500 characters each) for the new-task check. For subagents it sends their prompt, description and type. With no key, nothing goes anywhere except Anthropic.

### Tests

```sh
claude plugin test .
node eval/eval.ts
```

`eval/eval.ts` checks the first-prompt pick and the no-switch rule: real Jev calls through the hook, plus an audit of your past sessions. It needs Node 22.6 or newer.

## usage-mode

Three bars next to the session mode under the prompt, refreshed after every turn and after a compaction:

- `ctx`: the context window, split by category (used, free and so on) in the engine's own colours.
- `5h`: the 5-hour rate limit. The label turns into the time left until it resets (`42m`, `3.1h`).
- `week`: the weekly limit, the same way. A spend limit shows as `spend` when your plan has one.

The percentage is green under 60%, yellow from 60%, and red and bold from 85%. There are no options and it makes no network calls: the numbers come from the session itself.

## cache-tax-slim

Anthropic's prompt cache lives one hour. Step away for longer and the next message re-reads and re-writes the whole conversation at full price. This mod keeps that from surprising you.

- **Keep warm.** `/keepwarm` sends a tiny ping before the cache expires, for 6 hours by default. `/keepwarm 90m` sets a window, `/keepwarm always` never stops, `/keepwarm off` stops, `/keepwarm status` shows where it is. Warming uses model requests and costs tokens: read the price it shows before you leave it on.
- **Cold-send guard.** When the cache has gone cold and the conversation is large, the first send is dropped once with the estimated rewrite price; send again to go ahead. `/cache-tax guard warn` only shows the price instead, `/cache-tax guard refuse` goes back to stopping once.
- **Status.** `/cache-tax` prints the cache state, the cold price and this session's cold writes.
- **Band above the prompt.** Shows the cache state (`cache warm`), the git worktree (`main`, or the worktree name), and the router's model and effort when `model-router-slim` is installed.

Slimmed from cache-tax by Karan Bansal, MIT: his `LICENSE` is kept in `mods/cache-tax-slim/`. Prices are list prices as of September 2026 and sit in `PRICES` in `hooks/register.ts`.

If the original hook form (`cache-tax@claude-code-hooks`) is also installed, a cold send is guarded twice. Uninstall one, or set `/cache-tax guard warn` here.

## Layout

```
.claude-plugin/marketplace.json   the marketplace: lists the three mods
.claude-plugin/plugin.json        model-router-slim (this folder is the mod)
hooks/  eval/  tests/  types/     model-router-slim
mods/usage-mode/                  usage-mode
mods/cache-tax-slim/              cache-tax-slim
```

MIT licensed.
