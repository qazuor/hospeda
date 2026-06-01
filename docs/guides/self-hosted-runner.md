# Self-Hosted Runner for PR CI

Hospeda's `ci.yml` runs PR jobs on a self-hosted runner on the owner's
laptop instead of GitHub-hosted runners. This guide explains why, how
to register and operate the runner, and how to trigger the on-demand E2E
gate.

## Why self-hosted for PRs

The repo is **private**. GitHub's Free plan provides 2,000 Actions
minutes/month for private repos. `ci.yml` fires roughly 40 times per day
across 9 jobs, exhausting the quota quickly. Self-hosted runner minutes
are **free and unlimited** on private repos — they do not count against
the GitHub-hosted quota at all.

Only PR jobs move to the laptop. Push-to-`main`/`staging` stays on
GitHub-hosted runners so the validated baseline is always reachable even
when the laptop is off.

| Event | Runner | Minutes charged |
|---|---|---|
| `pull_request` (non-draft, same repo) | `leo-laptop` (self-hosted) | 0 |
| `push` to `main` or `staging` | `ubuntu-latest` (GitHub-hosted) | normal |
| Draft PR | `ubuntu-latest` (GitHub-hosted) | normal |
| Fork PR (if any) | `ubuntu-latest` (GitHub-hosted) | normal |

---

## Runner labels

The runner must be registered with exactly these labels:

```
self-hosted, linux, x64, leo-laptop
```

The `leo-laptop` label pins jobs to this specific machine. If a second
runner is added later, give it a different custom label so jobs route
explicitly.

---

## Registration

### 1. Open the registration page

GitHub repo → Settings → Actions → Runners → **New self-hosted runner**
→ select **Linux** and **x64**. GitHub displays a set of `./config.sh`
commands with a one-time token. Keep this page open.

### 2. Create a dedicated user

Run the runner under a separate Linux user, NOT your primary account.
This limits the blast radius if a workflow ever runs unexpected code.

```bash
sudo useradd -m -s /bin/bash github-runner
sudo passwd github-runner          # set a password
sudo usermod -aG docker github-runner   # needed for E2E service containers
```

### 3. Download and configure the runner

Switch to the `github-runner` user and follow GitHub's download commands
exactly as shown on the registration page. Then configure:

```bash
su - github-runner

# Download the runner tarball as shown on GitHub's registration page, then:
./config.sh \
  --url https://github.com/qazuor/hospeda \
  --token <TOKEN_FROM_GITHUB_UI> \
  --labels leo-laptop \
  --name leo-laptop \
  --unattended
```

The `--labels leo-laptop` flag is critical. Without it, `ci.yml` jobs
will not route to this machine.

### 4. Install the required toolchain

The runner environment must match what GitHub-hosted runners provide for
the build steps. Install these as the `github-runner` user (or system-wide):

| Tool | Required version | Install |
|---|---|---|
| Node.js | 20.x | `nvm install 20` or distro package |
| pnpm | 9.12.3 | `npm install -g pnpm@9.12.3` |
| Docker | >= 24 | system package; `github-runner` in `docker` group |
| Git | >= 2.40 | distro package |

Verify:

```bash
node --version   # v20.x.x
pnpm --version   # 9.12.3
docker info      # must not error (no sudo required for github-runner)
```

---

## Starting the runner

### Manual mode (start here)

Test the runner interactively first before installing it as a service.
Open a terminal as `github-runner` and run:

```bash
su - github-runner
cd ~/actions-runner
./run.sh
```

You should see `Listening for Jobs`. Open a PR in the repo — the CI jobs
should pick up on this machine instead of GitHub-hosted runners.

### Service mode (optional, for always-on operation)

Once you have confirmed the runner works correctly, install it as a
systemd service so it starts automatically on boot:

```bash
# As root or via sudo
sudo ./svc.sh install github-runner
sudo ./svc.sh start

# Check status
sudo ./svc.sh status
```

To stop and uninstall:

```bash
sudo ./svc.sh stop
sudo ./svc.sh uninstall
```

---

## Behavior when the laptop is offline

When the runner is offline, PR jobs **queue and wait** (GitHub holds
queued jobs for up to 24 hours). They do not fail immediately. Once the
runner comes back online and `./run.sh` is running, the queued jobs
execute automatically.

Push-to-`main`/`staging` CI is unaffected — those jobs always run on
GitHub-hosted runners.

---

## On-demand E2E gate

The `e2e-local.self-hosted.yml` workflow runs the Playwright suite on the
laptop on demand, consuming zero quota. Use it to validate a branch
before opening a PR or promoting to staging.

### Trigger via CLI

```bash
# P0 smoke on a specific branch (most common)
gh workflow run e2e-local.self-hosted.yml \
  -f branch=feat/my-feature \
  -f scope=p0

# Full suite (P0 + P1 + Resilience) on the current default branch
gh workflow run e2e-local.self-hosted.yml \
  -f scope=full
```

### Trigger via Actions UI

Actions → **E2E (Local / Self-Hosted)** → Run workflow → fill in
`branch` (optional) and `scope` (p0 or full) → Run workflow.

### Requirements

Docker must be running on the laptop. The workflow starts postgres,
redis, and mailpit as service containers (same configuration as
`e2e-pr.yml` and `e2e-nightly.yml`).

---

## Security considerations

- The runner executes only on `workflow_dispatch` (E2E gate) and
  `pull_request` events from the **same repository** (not forks).
  The fork guard in `ci.yml` ensures fork PRs fall back to
  `ubuntu-latest` and never reach the laptop.
- Draft PRs are excluded from the self-hosted path. They run on
  `ubuntu-latest` or can be skipped entirely by not opening them
  as ready.
- The `github-runner` user has no sudo access by default. Keep it
  that way.
- All `GITHUB_TOKEN` operations in `ci.yml` are scoped to
  `permissions: contents: read` (the workflow-level default).

---

## Troubleshooting

**Jobs stay queued indefinitely.**
The runner is not online. Start `./run.sh` (or the systemd service) as
the `github-runner` user and confirm it shows `Listening for Jobs`.

**Jobs fail with "native binding not found".**
The `setup` action has a `--force` reinstall fallback for `@rolldown`
bindings. If it fires repeatedly, run `pnpm install --frozen-lockfile
--force` manually as `github-runner` to warm the pnpm store.

**Docker service containers fail to start.**
Confirm `github-runner` is in the `docker` group (`groups github-runner`)
and that the Docker daemon is running (`systemctl status docker`). A
group change requires the user to log out and back in to take effect.

**E2E steps error on port 5433/6380/1025 already in use.**
A previous run left a container running. Check `docker ps` and remove
stale containers with `docker rm -f <id>`. GitHub Actions cleans up
service containers at job end, but a runner kill mid-job can leave them.
