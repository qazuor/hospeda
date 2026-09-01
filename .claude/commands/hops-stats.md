---
description: Repository and workflow statistics — code, tests, technical debt, per-package coverage, commits, PR hygiene, Linear backlog balance and disk usage, with a history log for comparing runs.
argument-hint: "[--section tests debt] [--period 1w|1m|3m|all] [--diff]"
---

Statistics come from a standalone TypeScript CLI. Arguments: $ARGUMENTS

**Say once per session that running it directly costs no context** — the output
goes to the user's terminal instead of into this conversation. In their shell:

```fish
hops-stats
```

With no flags and a terminal attached it opens an interactive menu (Clack):
first a short "measure or read the help" choice, then the section picker. With
flags it runs straight through, so it also works in an alias or a cron.
`--help` and the menu's help entry render the same page, whose "cómo leer los
números" block lists, per metric, the way it can be plausibly wrong.

## When invoked as a command

```bash
node scripts/hops-stats/dist/index.js --section <ids> <repo-path>
```

Always pass `--section`: this context has no TTY, so without it the CLI falls
back to `code tests debt` rather than prompting.

Then **interpret, do not transcribe**. The numbers are already on screen; your
value is what they mean — what moved, what breaks one of the project's own
rules, what a figure does not prove. Two or three observations, not a
re-reading of the tables.

## Sections

`code` · `tests` · `debt` · `packages` · `i18n` · `git` · `prs` · `linear`

| Flag | Effect |
|---|---|
| `-s, --section <ids...>` | pick sections explicitly |
| `--quick` | code + tests + debt |
| `--work` | git + prs + linear |
| `--offline` | everything that needs no network |
| `-a, --all` | every section |
| `-p, --period` | `1w` `1m` `3m` `all` (default `1m`) |
| `-t, --team <keys...>` | Linear teams (default: **both** `HOS` and `BETA`) |
| `-d, --diff` | deltas against the previous logged run |
| `--no-log` | do not record this run |
| `--json` | emit the flat record instead of the report |

## Detailed reports

A separate view — `hops-stats -r <id>`, or the menu's second entry. Reports
answer "what do I pick up now" with named rows, where a section answers "how are
we". They print and exit, and are never written to the history log.

| Report | Contents |
|---|---|
| `worktrees` | every worktree by what it holds; which can be deleted. Slow (`du`, 30-100 s) |
| `linear-stalled` | in-progress issues sorted by how long untouched, smoke queue, urgents, dead backlog |
| `i18n-untranslated` | keys present in every locale but holding the Spanish text verbatim |
| `prs-open` | open PRs grouped by what blocks each: conflict, red CI, pending, ready |
| `debt-detail` | biome-ignore by rule, `any` by file, every file over 1000 lines |

**`i18n-untranslated` reports two numbers and only the second is trustworthy.**
Identical strings include cognates — «Bar», «Tipo», «Piscina» are the same word
in Spanish and Portuguese and are correctly translated. The 4+ word column is the
signal: a whole phrase repeated verbatim is not a coincidence. Never quote the
raw identical count as untranslated work.

## Reading the numbers honestly

These belong in the report, not in footnotes. Repeat them when relevant:

1. **Test counts are static AND an undercount.** They count `it(`/`test(` in the
   source: they do not prove one runs, and every `.each` block expands to N tests
   at run time. Never say "N tests passing". Coverage and executed counts are
   absent on purpose — the full suite hangs the machine.
2. **Misplaced tests are still counted as tests.** The project rule is a `test/`
   directory beside `src/`, but files under `__tests__/` or next to the code are
   real tests and contribute to every count; they are listed separately as
   convention debt. A package with no `src/` is exempt, not misplaced — `apps/e2e`
   declares `testDir: './tests'` in its Playwright config and `scripts/` has no
   `src/` at all. Treating those as debt invents ~90 files nobody owes.
3. **i18n counts LEAF keys against `es`.** "Missing" is a key a user will see
   untranslated; "extra" is dead weight from a rename. A key existing does NOT
   mean it is translated — it may hold the Spanish string verbatim, which no
   structural check can detect.
4. **Declarative coverage matches by FILENAME**, over `.ts`/`.tsx`/`.astro` under
   `src/`, because tests live in `test/` directories rather than as siblings.
   Matching sibling paths reports every file as untested. A matching name does
   not prove that test covers that file, and an `.astro` page is usually covered
   by e2e rather than a unit test.
5. **A raw LOC total means nothing here** — JSON alone is nearly 3× the source.
   Every figure names its bucket.
6. **`any` excludes generated files.** Over half the raw hits live in
   `routeTree.gen.ts`, which nobody writes by hand.
7. **Churn is filtered** — unfiltered, lockfiles and task-master metadata sit at
   the top and say nothing about code.
8. **PR hygiene is grouped by merge commit**, i.e. the whole PR. Judging "code
   without tests" per commit is noise: tests and code are often committed apart.
9. **Date windows are LOCAL, not UTC.** `toISOString()` shifts every window a
   day west of Greenwich and halved the weekly commit count when it was used.
   All windows go through `src/dates.ts`.
10. **Git and GitHub figures are historical and recomputable. Linear's are not** —
   its API answers for the present only, so a state snapshot not taken today is
   unrecoverable tomorrow. That is why runs are logged.
11. **A failed section prints why it failed and reports nothing.** It never falls
   back to zeros. If a section shows a reason instead of numbers, say so rather
   than treating the absence as a measurement.

## Linear

Reads **both** teams by default — `HOS` (specs) and `BETA` (user-reported bugs).
A balance that ignores half the intake is not a balance. `-t beta` narrows it to
one. A team key Linear does not know answers an EMPTY LIST rather than an error,
so an unknown team is reported as a failure instead of a tidy zero.

Needs `LINEAR_API_KEY` in the environment or in `~/.config/hops-stats/config`
(`LINEAR_API_KEY='lin_api_...'`, mode 600). The file matters: a fish universal
variable is invisible to a subprocess and to cron. The MCP OAuth token is NOT a
substitute — it is issued for `mcp.linear.app` and `api.linear.app` rejects it.

## Source

`scripts/hops-stats/` — TypeScript, strict. Rebuild after editing:

```bash
cd scripts/hops-stats && corepack pnpm install && corepack pnpm build
```

Every external command runs through `run()` in `src/exec.ts`, which passes an
argv array and never a shell string — the class of quoting bug that produced
three silently wrong zeros in the shell version cannot occur there.

History log: `~/.local/share/hops-stats/history.jsonl`.
