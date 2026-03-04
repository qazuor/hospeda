# Operational Runbooks

## Overview

Operational runbooks are step-by-step guides for managing production systems, responding to incidents, and performing maintenance tasks. They provide consistent, repeatable procedures that any team member can follow during normal operations or emergencies.

**Purpose**: Ensure reliable, consistent operations through documented procedures

**Audience**: DevOps engineers, developers on-call, system administrators, technical support

**When to Use**: Production incidents, planned maintenance, scaling operations, disaster recovery

## What Are Runbooks?

Runbooks are operational documentation that provide:

- **Step-by-step instructions** for common operational tasks
- **Decision trees** for troubleshooting and problem resolution
- **Checklists** to ensure no steps are missed
- **Command examples** ready to copy and execute
- **Escalation paths** when procedures fail or issues persist

### Runbooks vs Other Documentation

| Type | Purpose | Audience | Style |
|------|---------|----------|-------|
| **Runbooks** | Operational procedures | Operators, on-call engineers | Step-by-step, action-oriented |
| **Architecture Docs** | System design | Architects, developers | Conceptual, explanatory |
| **API Docs** | Interface usage | Developers, integrators | Reference, examples |
| **User Guides** | Feature usage | End users | Tutorial, task-oriented |

## Available Runbooks

### Production Operations

1. **[Production Bugs](./production-bugs.md)** (~1,400 lines)
   - Investigating production issues
   - Initial response procedures (5 min)
   - Investigation steps (logs, metrics, changes)
   - Common issues and solutions
   - Rollback decision tree
   - Post-incident procedures

1. **[Rollback Procedures](./rollback.md)** (~1,200 lines)
   - Rolling back deployments safely
   - Frontend rollback (Vercel)
   - Backend rollback (Vercel)
   - Database migration rollback
   - Rollback decision criteria
   - Post-rollback verification

1. **[Backup & Recovery](./backup-recovery.md)** (~1,300 lines)
   - Database backup procedures
   - Point-in-time recovery (Neon)
   - Local backup/restore (Docker PostgreSQL)
   - Data corruption recovery
   - Disaster recovery procedures
   - Backup verification

### Scaling & Performance

1. **[Scaling Procedures](./scaling.md)** (~1,100 lines)
   - Handling load increases
   - Scaling triggers and thresholds
   - Frontend scaling (Vercel)
   - Backend scaling (Vercel serverless)
   - Database scaling (Neon)
   - Load testing procedures
   - Cost optimization

1. **[Monitoring & Alerting](./monitoring.md)** (~1,200 lines)
   - Monitoring setup and configuration
   - Key metrics to track
   - Alert configuration
   - Dashboard management
   - Log analysis procedures
   - Daily/weekly/monthly reviews

## Quick Navigation

### Emergency Scenarios

| Scenario | Runbook | Section |
|----------|---------|---------|
| Site is down | [Production Bugs](./production-bugs.md) | Initial Response |
| API returning 500 errors | [Production Bugs](./production-bugs.md) | Common Issues |
| Need to rollback deployment | [Rollback](./rollback.md) | Rollback Procedures |
| Database connection failures | [Production Bugs](./production-bugs.md) | Common Issues |
| Accidental data deletion | [Backup & Recovery](./backup-recovery.md) | Recovery Procedures |
| Traffic spike | [Scaling](./scaling.md) | Emergency Scaling |
| Slow queries | [Production Bugs](./production-bugs.md) | Investigation Steps |
| Memory/CPU at 100% | [Scaling](./scaling.md) | Scaling Triggers |

### Planned Maintenance

| Task | Runbook | Section |
|------|---------|---------|
| Create database backup | [Backup & Recovery](./backup-recovery.md) | Backup Procedures |
| Test backup restore | [Backup & Recovery](./backup-recovery.md) | Backup Verification |
| Scale for event | [Scaling](./scaling.md) | Planned Scaling |
| Review performance metrics | [Monitoring](./monitoring.md) | Weekly Review |
| Configure new alerts | [Monitoring](./monitoring.md) | Alert Configuration |

## Runbook Structure

All runbooks follow a consistent structure for ease of use:

```markdown
# Runbook Title

## Overview
- Brief description
- When to use this runbook
- Expected outcomes

## Prerequisites
- Required access/permissions
- Tools needed
- Knowledge requirements

## Procedures
### Procedure Name
**Step 1**: Action to take
- Details
- Commands
- Expected output

**Step 2**: Next action
- Details
- Commands
- Expected output

[Continue with all steps]

## Verification
- How to verify success
- Expected results
- Health checks

## Troubleshooting
- Common issues
- Error messages
- Solutions

## Post-Procedure
- Cleanup tasks
- Documentation updates
- Communication

## Checklists
- [ ] Pre-procedure checklist
- [ ] Procedure steps
- [ ] Post-procedure verification

## Related Documentation
- Links to related runbooks
- Architecture docs
- API docs
```

## Emergency Procedures

### Severity Levels

| Level | Response Time | Escalation | Examples |
|-------|---------------|------------|----------|
| **Critical** | Immediate (< 5 min) | On-call manager | Complete outage, data loss, security breach |
| **High** | < 30 minutes | Team lead | Partial outage, major feature broken |
| **Medium** | < 2 hours | During business hours | Performance degradation, minor bugs |
| **Low** | Next business day | Normal workflow | Cosmetic issues, feature requests |

### Initial Response (First 5 Minutes)

1. **Assess Severity**: Use severity matrix above
2. **Check Service Health**: Run health check commands
3. **Communicate**: Post in team channel with severity and status
4. **Follow Runbook**: Use appropriate runbook for the issue
5. **Escalate if Needed**: Don't hesitate to escalate

### When to Escalate

**Immediate Escalation**:

- You don't have required access or permissions
- Issue is outside your expertise
- Multiple systems affected
- Data loss or security risk
- Issue persists after following runbook

**Escalation Path**:

1. **First**: Team lead (check team roster)
2. **Second**: On-call manager (see contact list)
3. **Third**: CTO (critical issues only)

### Emergency Contacts

**Template** - Update with actual contacts:

```yaml
Team Leads:
  - Name: [Team Lead Name]
    Role: Team Lead
    Phone: [Phone]
    Email: [Email]
    Slack: @[username]

On-Call Rotation:
  - Week: [Date Range]
    Primary: [Name]
    Secondary: [Name]

Management:
  - Name: [Manager Name]
    Role: Engineering Manager
    Phone: [Phone]
    Email: [Email]

External Support:
  - Vercel Support: support@vercel.com
  - Neon Support: support@neon.tech
  - GitHub Support: support@github.com
```

**Note**: Keep contact information in secure location (e.g., 1Password, team wiki)

## Tools & Access

### Required Access

| System | Access Level | How to Request | Typical Use |
|--------|--------------|----------------|-------------|
| **Vercel** | Admin | Team invitation | Frontend deployments, rollbacks |
| **Neon Console** | Admin | Team invitation | Database operations, backups |
| **GitHub** | Write | Repository settings | Code deployments, Actions |
| **Vercel (API)** | Admin | Team invitation | API deployments, scaling, rollbacks |
| **Production DB** | Read-only | DBA approval | Query analysis, debugging |

### Common Tools

#### Deployment & Infrastructure

- **Vercel CLI**: Deployment management (all apps including API)

  ```bash
  # Install
  pnpm add -g vercel

  # Login
  vercel login

  # List deployments
  vercel list

  # Rollback
  vercel rollback
  ```

- **GitHub CLI**: Repository and Actions management

  ```bash
  # Install
  brew install gh  # macOS
  # or: https://cli.github.com/

  # Login
  gh auth login

  # List workflow runs
  gh run list

  # View logs
  gh run view [run-id]
  ```

#### Database Tools

- **psql**: PostgreSQL command-line client

  ```bash
  # Connect to production (read-only replica recommended)
  psql $DATABASE_URL_REPLICA

  # Connect to local
  psql postgresql://hospeda_user:hospeda_password@localhost:5432/hospeda_dev

  # Run query
  psql $DATABASE_URL -c "SELECT version()"
  ```

- **pgAdmin**: Web-based database management
  - Local: <http://localhost:5050>
  - Production: Use Neon Console web UI

- **Drizzle Studio**: Schema visualization

  ```bash
  cd packages/db
  pnpm db:studio
  # Opens: http://localhost:4983
  ```

#### Monitoring & Logs

- **Vercel Dashboard**: Frontend monitoring
  - URL: <https://vercel.com/[team]/[project>]
  - Logs, analytics, deployments

- **Neon Console**: Database monitoring
  - URL: <https://console.neon.tech>
  - Query performance, connections, branches

- **GitHub Actions**: CI/CD monitoring
  - URL: <https://github.com/[org]/hospeda/actions>
  - Build logs, test results

#### Development Tools

- **Docker**: Local infrastructure

  ```bash
  # Start services
  docker compose up -d

  # View logs
  docker compose logs -f [service]

  # Stop services
  docker compose down
  ```

- **PNPM**: Package management

  ```bash
  # Install dependencies
  pnpm install

  # Run commands
  pnpm dev
  pnpm test
  pnpm db:migrate
  ```

### Tool Installation Checklist

For new team members or on-call rotation:

- [ ] Install Vercel CLI and authenticate
- [ ] Install GitHub CLI and authenticate
- [ ] Install psql (PostgreSQL client)
- [ ] Install Docker Desktop
- [ ] Install Node.js 20+ and PNPM 8+
- [ ] Clone repository and install dependencies
- [ ] Set up local development environment
- [ ] Request production access (read-only first)
- [ ] Add to team communication channels
- [ ] Review all runbooks

## Communication Guidelines

### During Incidents

**Start of Incident**:

```text
🚨 [SEVERITY] [COMPONENT] [BRIEF DESCRIPTION]

Status: Investigating
Impact: [User-facing impact]
Started: [Timestamp]
Assigned: @[username]
Runbook: [Link to runbook if applicable]
```

**Updates** (every 15-30 minutes):

```text
📊 UPDATE: [COMPONENT]

Progress: [What's been done]
Current: [What's being done now]
ETA: [Expected resolution time or "Unknown"]
```

**Resolution**:

```text
✅ RESOLVED: [COMPONENT]

Issue: [Brief description]
Cause: [Root cause]
Fix: [What was done]
Duration: [Total time]
Follow-up: [Link to post-mortem or issue]
```

### Post-Incident Communication

**Internal**:

- Post-mortem document (template in [production-bugs.md](./production-bugs.md))
- Team meeting to review incident
- Update runbooks with learnings

**External** (if user-facing):

- Status page update
- Email to affected users (if appropriate)
- Blog post for major incidents

## Runbook Maintenance

### Review Schedule

| Frequency | Activity | Owner |
|-----------|----------|-------|
| **After each use** | Update with learnings | Executor |
| **Monthly** | Review for accuracy | Team lead |
| **Quarterly** | Update contact info | Engineering manager |
| **Semi-annually** | Full review and cleanup | Tech lead |

### When to Update

**Immediate Update**:

- Runbook procedure didn't work
- Missing critical steps
- Incorrect commands or information
- New tool or system changes

**Scheduled Update**:

- Contact information changes
- Tool version updates
- Process improvements
- Organizational changes

### Update Procedure

1. **Make Changes**: Edit runbook file
2. **Document Change**: Add note in changelog section
3. **Review**: Get review from team member
4. **Commit**: Use conventional commit format

   ```bash
   docs(runbooks): update [runbook-name] with [change]
   ```

5. **Communicate**: Announce changes in team channel

### Runbook Changelog

Each runbook includes a changelog section:

```markdown
## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial creation | @tech-writer |
| 2025-11-15 | Added new recovery scenario | @operator |
```

## Best Practices

### Writing Runbooks

**Do**:

- Use clear, numbered steps
- Include actual commands ready to copy
- Provide expected output/results
- Add verification steps
- Include troubleshooting section
- Use checklists for complex procedures
- Link to related documentation

**Don't**:

- Assume prior knowledge
- Skip verification steps
- Use vague instructions ("check the system")
- Forget to document changes
- Write overly long procedures (break into sub-runbooks if needed)

### Using Runbooks

**Do**:

- Follow steps exactly as written
- Document deviations and why
- Update runbook if steps don't work
- Communicate progress during incidents
- Verify each step before proceeding
- Ask for help if unsure

**Don't**:

- Skip steps
- Assume you know better (runbooks exist for a reason)
- Forget to document issues
- Hesitate to escalate
- Make changes without following procedure

## Related Documentation

### Architecture & Design

- [Architecture Overview](../architecture/README.md)
- [System Components](../architecture/components.md)
- [Data Flow](../architecture/data-flow.md)
- [Infrastructure](../architecture/infrastructure.md)

### Development

- [Development Setup](../development/setup.md)
- [Testing Guide](../development/testing.md)
- [Deployment Guide](../development/deployment.md)

### Operations

- [Security Policies](../security/README.md)
- [Performance Optimization](../performance/README.md)
- [Monitoring Setup](../performance/monitoring.md)

### Support

- [Troubleshooting Guide](../troubleshooting/README.md)
- [FAQ](../faq.md)

## Contributing

### Adding New Runbooks

If you identify the need for a new runbook:

1. **Propose**: Create issue with runbook proposal
2. **Draft**: Write initial version following template
3. **Review**: Get review from team lead and affected team
4. **Test**: Have someone unfamiliar follow the runbook
5. **Publish**: Merge and announce to team
6. **Maintain**: Add to review schedule

### Improving Existing Runbooks

Found an issue or improvement?

1. **Document**: Note what needs improvement
2. **Update**: Make changes following style guide
3. **Test**: Verify procedure works
4. **Submit**: Create PR with changes
5. **Review**: Get approval from runbook owner
6. **Merge**: Deploy changes

## Glossary

| Term | Definition |
|------|------------|
| **Runbook** | Step-by-step operational procedure |
| **Incident** | Unplanned interruption or degradation of service |
| **Rollback** | Reverting to previous known-good state |
| **Escalation** | Forwarding issue to higher-level support |
| **Post-mortem** | Analysis document after incident |
| **On-call** | Engineer responsible for emergency response |
| **SLA** | Service Level Agreement (uptime/performance targets) |
| **RTO** | Recovery Time Objective (max acceptable downtime) |
| **RPO** | Recovery Point Objective (max acceptable data loss) |
| **Hotfix** | Urgent fix deployed outside normal process |

## Support

### Getting Help

**During Incidents**:

- Check relevant runbook first
- Escalate using escalation path
- Post in team emergency channel

**For Runbook Questions**:

- Ask in team channel
- Contact runbook maintainer
- Create issue for improvements

### Training

**New Team Members**:

- Complete tool installation checklist
- Shadow on-call engineer
- Review all runbooks
- Participate in practice drills

**Continuing Education**:

- Monthly incident reviews
- Quarterly runbook updates
- Tool training sessions
- Architecture deep dives

## Appendix

### Useful Commands

#### Health Checks

```bash
# API health
curl -f https://api.hospeda.com/health || echo "API DOWN"

# Database connection
psql $DATABASE_URL -c "SELECT 1" || echo "DB DOWN"

# Web app (HTTP 200)
curl -sI https://hospeda.com | grep "200 OK" || echo "WEB DOWN"

# Admin app
curl -sI https://admin.hospeda.com | grep "200 OK" || echo "ADMIN DOWN"
```

#### Quick Diagnostics

```bash
# Check recent deployments
gh api repos/:owner/:repo/deployments | jq '.[0:3]'

# Check GitHub Actions status
gh run list --limit 10

# Check Docker services
docker compose ps

# Check database connections (local)
docker exec hospeda_postgres psql -U hospeda_user -d hospeda_dev -c "SELECT count(*) FROM pg_stat_activity"
```

#### Log Analysis

```bash
# Vercel logs (via CLI)
vercel logs [deployment-url]

# Docker logs
docker compose logs -f --tail=100 [service]

# GitHub Actions logs
gh run view [run-id] --log

# Database logs (via Neon Console or pgAdmin)
```

### Reference Links

**Official Documentation**:

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Hono Documentation](https://hono.dev/)

**Hospeda Documentation**:

- [Project README](../../README.md)
- [Architecture Docs](../architecture/)
- [Development Docs](../development/)
- [API Docs](../api/)

**Tools**:

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Neon Console](https://console.neon.tech)
- [GitHub Actions](https://github.com/features/actions)

### Incident Severity Matrix

| Severity | Description | Examples | Response Time | Escalation |
|----------|-------------|----------|---------------|------------|
| **Critical** | Complete service outage or data loss | Site down, database unavailable, security breach | < 5 minutes | Immediate |
| **High** | Major feature broken or severe degradation | API errors, payment failures, booking system down | < 30 minutes | If unresolved in 30 min |
| **Medium** | Minor feature broken or performance issues | Search slow, email delays, UI glitches | < 2 hours | If unresolved in 2 hours |
| **Low** | Cosmetic issues or minor bugs | Typos, styling issues, non-critical features | Next business day | Normal workflow |

### SLA Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Uptime** | 99.9% | Monthly |
| **API Response Time** | < 200ms (p95) | Rolling 24h |
| **Page Load Time** | < 2.5s (LCP) | Rolling 24h |
| **Error Rate** | < 0.1% | Rolling 24h |
| **Database Query Time** | < 50ms (p95) | Rolling 24h |

### Contact Template

```yaml
# .emergency-contacts.yml (keep in secure location)

team:
  tech_lead:
    name: "[Name]"
    email: "[email]"
    phone: "[phone]"
    slack: "@[username]"
    timezone: "America/Argentina/Buenos_Aires"

  on_call:
    current:
      primary: "[Name]"
      secondary: "[Name]"
      week: "[Date range]"
    rotation:
      - week: "[Date range]"
        primary: "[Name]"
        secondary: "[Name]"

management:
  engineering_manager:
    name: "[Name]"
    email: "[email]"
    phone: "[phone]"
    slack: "@[username]"

external:
  vercel:
    support: "support@vercel.com"
    docs: "https://vercel.com/docs"
    status: "https://www.vercel-status.com/"

  neon:
    support: "support@neon.tech"
    docs: "https://neon.tech/docs"
    status: "https://neonstatus.com/"

  github:
    support: "support@github.com"
    docs: "https://docs.github.com"
    status: "https://www.githubstatus.com/"
```

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial runbook portal creation | @tech-writer |

---

**Last Updated**: 2025-11-06
**Maintained By**: Tech Lead & DevOps Team
**Review Frequency**: Monthly
