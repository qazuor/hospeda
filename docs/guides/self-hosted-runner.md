# Self-Hosted Runner (Optional)

> **Status as of 2026-06:** The repo is now **public**. GitHub-hosted runners
> (`ubuntu-latest`) provide free, unlimited minutes for public repositories and
> run all CI jobs in parallel. The self-hosted runner is therefore **optional**
> — it is no longer the primary CI path. This guide is kept as a reference for
> re-registering the runner when needed (cost-sensitive scenarios, offline
> validation, or on-demand E2E gating).

---

## Background: why this runner existed

When the repo was **private**, GitHub's Free plan provided only 2,000 Actions
minutes/month. With `ci.yml` firing roughly 40 times per day across 9 jobs,
the quota was exhausted quickly. Routing PR jobs to a self-hosted runner on the
owner's laptop kept minutes at zero, because self-hosted minutes are always
free.

Now that the repo is public, GitHub-hosted minutes are also free and unlimited,
so all jobs run on `ubuntu-latest` by default (see `ci.yml`). The self-hosted
path is retained as a documented option.

---

## Current CI routing

All CI jobs currently use `ubuntu-latest`:

| Event | Runner |
|---|---|
| `pull_request` (any state) | `ubuntu-latest` (GitHub-hosted) |
| `push` to `main` or `staging` | `ubuntu-latest` (GitHub-hosted) |
| `workflow_dispatch` (E2E gate) | `ubuntu-latest` (GitHub-hosted) |

To re-enable self-hosted routing for PRs, add a dynamic `runs-on` expression
back to `ci.yml` (for example, switching non-draft same-repo PRs to
`[self-hosted, linux, x64, leo-laptop]`). That change is reversible and
documented in the git history.

---

## Runner labels

The runner must be registered with exactly these labels:

```
self-hosted, linux, x64, leo-laptop
```

The `leo-laptop` label pins jobs to this specific machine. If a second runner
is added later, give it a different custom label so jobs route explicitly.

---

## Re-registering the runner

The runner was deregistered on 2026-06-04. These steps restore it.

### 1. Generate a new registration token

```bash
gh api -X POST repos/qazuor/hospeda/actions/runners/registration-token \
  --jq .token
```

Copy the token — it expires in one hour.

### 2. Remove the stale local registration

On the runner machine, as the `github-runner` user:

```bash
cd ~/actions-runner
./config.sh remove
```

This clears the local `.runner` and `.credentials` files left over from the
previous registration.

### 3. Re-register with the new token

```bash
./config.sh \
  --url https://github.com/qazuor/hospeda \
  --token <TOKEN> \
  --name leo-laptop \
  --labels self-hosted,linux,x64,leo-laptop \
  --replace
```

The `--replace` flag re-uses the runner name and removes any stale server-side
record with the same name.

### 4. Start the systemd service

```bash
sudo systemctl enable --now actions.runner.qazuor-hospeda.leo-laptop.service
```

Confirm it is listening:

```bash
sudo systemctl status actions.runner.qazuor-hospeda.leo-laptop.service
```

You should see `Listening for Jobs` in the logs.

---

## First-time setup (new machine)

If the runner directory does not exist yet, follow these steps before the
re-registration steps above.

### 1. Create a dedicated user

Run the runner under a separate Linux user, not your primary account. This
limits the blast radius if a workflow ever runs unexpected code.

```bash
sudo useradd -m -s /bin/bash github-runner
sudo passwd github-runner
sudo usermod -aG docker github-runner   # needed for E2E service containers
```

### 2. Download and configure the runner

Switch to the `github-runner` user and follow GitHub's download commands as
shown on the registration page (Settings → Actions → Runners → New
self-hosted runner → Linux / x64), then configure using the command in
step 3 of "Re-registering the runner" above.

### 3. Install the required toolchain

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
docker info      # must not error (no sudo for github-runner)
```

---

## Starting the runner manually

Test the runner interactively before relying on the service:

```bash
su - github-runner
cd ~/actions-runner
./run.sh
```

You should see `Listening for Jobs`. Open or re-push a PR (if routing has been
switched back to self-hosted) — jobs should appear on this machine.

---

## Service management

```bash
# Install and start
sudo ./svc.sh install github-runner
sudo ./svc.sh start

# Check status
sudo ./svc.sh status

# Stop and uninstall
sudo ./svc.sh stop
sudo ./svc.sh uninstall
```

Alternatively, once the service is registered via `./config.sh`, use systemctl
directly (see "Re-registering the runner" step 4).

---

## On-demand E2E gate

The `e2e-local.self-hosted.yml` workflow runs the Playwright suite on the
laptop on demand. It is useful for validating a branch before opening a PR or
promoting to staging without waiting for the full CI queue.

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

Actions → **E2E (Local / Self-Hosted)** → Run workflow → fill in `branch`
(optional) and `scope` (`p0` or `full`) → Run workflow.

### Requirements

Docker must be running on the laptop. The workflow starts postgres, redis, and
mailpit as service containers (same configuration as `e2e-pr.yml` and
`e2e-nightly.yml`).

---

## Behavior when the runner is offline

When the runner is offline and jobs are routed to it, those jobs **queue and
wait** (GitHub holds queued jobs for up to 24 hours). They do not fail
immediately. Once the runner comes back online, queued jobs execute
automatically.

With the current all-`ubuntu-latest` routing this is not a concern — jobs run
immediately regardless of laptop state.

---

## Security considerations

- Keep the `github-runner` user without sudo access.
- The fork guard in `ci.yml` ensures fork PRs always run on `ubuntu-latest`
  and never reach the laptop, even if self-hosted routing is re-enabled for
  same-repo PRs.
- All `GITHUB_TOKEN` operations in `ci.yml` are scoped to
  `permissions: contents: read` (the workflow-level default).

---

## Troubleshooting

**Jobs stay queued indefinitely.**
The runner is not online. Start `./run.sh` (or the systemd service) as
`github-runner` and confirm it shows `Listening for Jobs`.

**Jobs fail with "native binding not found".**
The `setup` action has a `--force` reinstall fallback for `@rolldown` bindings.
If it fires repeatedly, run `pnpm install --frozen-lockfile --force` manually
as `github-runner` to warm the pnpm store.

**Docker service containers fail to start.**
Confirm `github-runner` is in the `docker` group (`groups github-runner`) and
that the Docker daemon is running (`systemctl status docker`). A group change
requires the user to log out and back in to take effect.

**E2E steps error on port 5433/6380/1025 already in use.**
A previous run left a container running. Check `docker ps` and remove stale
containers with `docker rm -f <id>`. GitHub Actions cleans up service
containers at job end, but a runner kill mid-job can leave them.

**`./config.sh remove` fails with "service is running".**
Stop the service first: `sudo systemctl stop actions.runner.qazuor-hospeda.leo-laptop.service`,
then re-run `./config.sh remove`.
