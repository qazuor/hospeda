# hops-stats

Repository and workflow statistics for this monorepo: code size, tests,
technical debt, per-package coverage, translations, commits, PR hygiene and the
Linear backlog — plus detailed reports that list what to pick up next.

Sibling of `scripts/server-tools` (`hops`), and like it, a standalone CLI rather
than a workspace package: it is not in `pnpm-workspace.yaml`, so turbo does not
build, test or typecheck it as part of the monorepo pipeline.

## Setup

```bash
cd scripts/hops-stats
corepack pnpm install
corepack pnpm build
```

Then run it from the repository root:

```bash
node scripts/hops-stats/dist/index.js
```

For daily use, a shell function is more comfortable. In fish:

```fish
function hops-stats --description 'Estadísticas del repo'
    set -l repo (git rev-parse --show-toplevel 2>/dev/null; or echo /path/to/hospeda2)
    node $repo/scripts/hops-stats/dist/index.js $argv $repo
end
funcsave hops-stats
```

**Running it yourself costs no agent context** — the output goes to your
terminal instead of into a conversation. The `/hops-stats` slash command exists
for when you want the numbers interpreted rather than just printed.

## Usage

With no flags and a terminal attached, it opens a menu: measure, read a detailed
report, or read the help. With flags it runs straight through, so it also works
in an alias or a cron.

```bash
hops-stats                        # menu
hops-stats -s tests debt          # specific sections
hops-stats --quick                # code + tests + debt (~2s)
hops-stats --work -p 1w           # git + PRs + Linear, last week
hops-stats -r i18n-untranslated   # a detailed report
hops-stats --all --diff           # everything, plus what changed since last run
hops-stats --help                 # full help, including how to read each number
```

### Sections

`code` · `tests` · `debt` · `packages` · `i18n` · `git` · `prs` · `linear`

### Reports

A separate view: named rows you can act on, rather than numbers.

| Report | Contents |
|---|---|
| `worktrees` | every worktree by what it holds; which are safe to delete |
| `linear-stalled` | in-progress issues by how long untouched, smoke queue, urgents |
| `i18n-untranslated` | keys present in every locale but holding the Spanish text |
| `prs-open` | open PRs grouped by what blocks each one |
| `debt-detail` | biome-ignore by rule, `any` by file, files over 1000 lines |

## Linear

The `linear` section and the `linear-stalled` report need a personal API key
(Linear → Settings → Security & access → Personal API keys). It is read from
`LINEAR_API_KEY`, then from `~/.config/hospeda/stats.conf`, then from
`~/.config/hops-stats/config`:

```
LINEAR_API_KEY='lin_api_...'
```

`chmod 600`, and outside any repository. Every candidate is tried until one
authenticates, so a stale key in the environment does not shadow a valid one in
the file — and the error names which source was rejected.

Both teams are read by default (`HOS` for specs, `BETA` for reported bugs);
`-t beta` narrows it to one.

## How to read the numbers

Every figure here has a way of being wrong that looks entirely plausible, which
is why `--help` carries a block naming them one by one. The ones that bite most:

- **Test counts are static AND an undercount.** They count `it(`/`test(` in the
  source: they do not prove one runs, and each `.each` block expands to N tests
  at run time. Coverage and executed counts are deliberately absent — running
  the full suite is not something this tool should do.
- **`i18n-untranslated` prints two numbers and only the second is trustworthy.**
  Identical strings include cognates: «Bar», «Tipo» and «Piscina» are the same
  word in Spanish and Portuguese and are correctly translated. The 4+ word
  column is the signal.
- **Declarative coverage matches by FILENAME**, because tests live in `test/`
  directories rather than beside the code. A matching name does not prove that
  test covers that file.
- **Date windows are local, not UTC.** `toISOString()` shifts every window a day
  west of Greenwich; it once reported half the week's commits.
- **A failed section prints why it failed and reports nothing.** It never falls
  back to zero. A formatted zero is the most believable wrong answer a report
  can give, and this tool is built so it cannot produce one.

## Design

`src/exec.ts` runs every external command through `execFile` with an argv array
— never a shell string. Quoting bugs (a `sed` delimiter colliding, nested quotes
in an embedded script, `rg` reading stdin because no path was passed) are the
class of failure that produced silently wrong zeros in the shell version this
replaced, and they cannot occur here.

Each section returns `Outcome<T>`: data, or the reason it could not produce any.

Runs are appended to `~/.local/share/hops-stats/history.jsonl` so `--diff` can
compare against the previous one. Linear's counts are the perishable ones: its
API answers for the present only, so a snapshot not taken today cannot be
reconstructed tomorrow.
