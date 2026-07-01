# `.specs/` — Technical Specs

This directory holds the **technical detail and internal implementation tracking**
for Hospeda specs. It is NOT a tracking system — it does not define what specs
exist, their priority, or their macro status.

## Source of truth

**Linear (team `Hospeda`, key `HOS`) is the single source of truth for macro
tracking**: existence of specs, status (active/blocked/done), priority,
dependencies between specs, bugs, small tasks, "needs spec" ideas, owner
decisions, env vars, migrations, and global architecture/product decisions.

This repo never re-derives or duplicates that state. If `.specs/` and Linear
disagree on macro status, **Linear wins**.

## Layout

```text
.specs/
  HOS-123-booking-calendar-ui/
    spec.md
    tasks/          # Task Master internal tracking (optional, created when implementation starts)
    docs/           # auxiliary docs (optional)
    closeout.md     # optional, filled when the spec ships
  _templates/
    spec.md
    closeout.md
```

Rules:

- One folder per spec, named `HOS-<issue-number>-<slug>`.
- The `HOS-<number>` prefix is the Linear issue identifier — it is assigned
  by Linear when the tracking issue is created, never invented locally.
- `spec.md` is required and must have `linear:` + `statusSource: linear` in
  its frontmatter (see `_templates/spec.md`).
- `tasks/` holds Task Master's internal implementation tracking for that one
  spec. Task Master no longer tracks specs globally — see below.
- No CSV, no global index.json, no macro state duplicated anywhere in this
  directory.

## Resolving "spec 123"

When asked to work on "spec 123", resolve it as Linear issue `HOS-123`, then
open `.specs/HOS-123-*/spec.md`. Do not invent a `SPEC-123` identifier — that
numbering scheme belonged to the old `.qtm/` system and is retired for new
work (existing `.qtm/specs/SPEC-NNN-*` folders are historical and stay as-is
until closed or migrated).

## Task Master scope

Task Master is used only for **internal implementation tracking of a single
spec**, living inside that spec's `tasks/` folder. It does not:

- define which specs exist globally,
- track priority or roadmap,
- track bugs or small tasks (those live directly in Linear — team `Hospeda`
  for specs/roadmap, team `Beta Feedback` for user/QA-reported bugs and small
  items),
- own the `HOS-<number>` allocation (that's Linear's issue counter).

### Promoting an internal task to Linear

Create a Linear issue for something that started as an internal Task Master
task when it:

- blocks another spec,
- needs another agent working on it in parallel,
- survives as a follow-up outside the current spec's scope,
- represents an owner decision,
- meaningfully affects deploy/release,
- must be visible on the roadmap independent of this spec's closure.

Don't create a Linear issue per microtask — that defeats the purpose and
burns through the Free plan's issue cap fast.

## Env vars / migrations / global decisions

These are recorded on the spec's Linear issue (`HOS-xxx`), not in this repo.
See the "Spec Implementation" issue template in Linear for the exact
sections (Env vars added/changed, Migrations added, Global decision log,
Owner decisions).

## Large epics

A spec expected to decompose into several child specs (e.g. a big
product-strategy epic) is tracked as a **Linear Project** under team
`Hospeda`, not a single issue. Child specs get their own normal `HOS-xxx`
issue + `.specs/HOS-xxx-slug/` folder once they're concretely scoped, linked
to that project.

## Legacy specs (`.qtm/`)

Specs created before this migration (2026-07-01) live in `.qtm/specs/` under
the old `SPEC-NNN` numbering and are **not** retroactively renumbered. Active
ones get a Linear issue + a `.specs/HOS-xxx-slug/` folder as they're picked
up; completed ones stay where they are as historical record.
