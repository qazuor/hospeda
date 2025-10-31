# MCP Servers Installation Guide

Complete guide for installing and configuring Model Context Protocol (MCP) servers for the Hospeda project.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Official HTTP MCPs](#official-http-mcps)
4. [Local STDIO MCPs](#local-stdio-mcps)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)
7. [Related Documentation](#related-documentation)

---

## Overview

MCP servers extend Claude Code's capabilities by providing specialized integrations for:

- Documentation and code analysis
- Project management and issue tracking
- Database operations
- Deployment and monitoring
- Security scanning
- Translation and localization

**Installation Methods:**

- **HTTP MCPs**: Remote servers (via `claude mcp add`)
- **STDIO MCPs**: Local processes (via `claude mcp add-json`)

---

## Prerequisites

Before installing MCP servers, ensure you have:

- [x] Claude Code CLI installed
- [x] Node.js ≥18 (for STDIO servers)
- [x] Python ≥3.8 (for Python-based servers)
- [x] API keys for relevant services

**Verify installation:**

```bash
node --version  # Should be ≥18
python3 --version  # Should be ≥3.8
claude --version  # Should show Claude Code version
```

---

## Official HTTP MCPs

These servers run remotely and are accessed via HTTP. Requires internet connection.

### Context7 – Live Documentation

**Purpose:** Fetch up-to-date library documentation and code examples

```bash
claude mcp add --transport http context7 https://mcp.context7.com/mcp \
  --header "CONTEXT7_API_KEY: <YOUR_CONTEXT7_API_KEY>"
```

**Requirements:**

- Context7 API key from [context7.com](https://context7.com)

**Usage:**

- Get docs for any library: `mcp__context7__get-library-docs`
- Resolve library IDs: `mcp__context7__resolve-library-id`

---

### Linear – Task and Issue Tracking

**Purpose:** Manage Linear issues and sync planning sessions

```bash
claude mcp add --transport http linear https://mcp.linear.app/mcp
```

**Requirements:**

- Linear workspace and OAuth authentication

**Usage:**

- Create/update issues
- Sync planning sessions to Linear
- Query project status

---

### GitHub – Repository Integration

**Purpose:** Manage GitHub repositories, PRs, and issues

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
```

**Requirements:**

- GitHub account with repository access

**Usage:**

- Create and manage PRs
- Sync issues
- Repository operations

---

### Mercado Pago – Payment Processing

**Purpose:** Handle payment integrations for Hospeda platform

```bash
claude mcp add --transport http mercadopago https://mcp.mercadopago.com/mcp \
  --header "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

**Requirements:**

- Mercado Pago account and access token

**Usage:**

- Process payments
- Manage subscriptions
- Handle webhooks

**Documentation:** Use `mcp__mercadopago__search_documentation`

---

### Sentry – Error Monitoring

**Purpose:** Production error tracking and monitoring

```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

**Requirements:**

- Sentry account and project

**Usage:**

- Query error reports
- Analyze stack traces
- Track performance issues

---

### Vercel – Deployment Management

**Purpose:** Manage Vercel deployments and projects

```bash
claude mcp add --transport http vercel https://mcp.vercel.com/
```

**Requirements:**

- Vercel account with project access

**Usage:**

- Deploy applications
- Manage environment variables
- Monitor deployments

---

### Neon – Cloud PostgreSQL

**Purpose:** Manage Neon PostgreSQL databases and branches

```bash
claude mcp add --transport http neon https://mcp.neon.tech/mcp \
  --header "Authorization: Bearer <YOUR_NEON_API_KEY>"
```

**Requirements:**

- Neon account and API key

**Usage:**

- Create database branches
- Run SQL queries
- Manage migrations
- Performance tuning

**Key Features:**

- Database branching for development
- Automated schema migrations
- Query optimization suggestions

---

### Socket – Dependency Security

**Purpose:** Analyze npm dependencies for security vulnerabilities

```bash
claude mcp add --transport http socket https://mcp.socket.dev/
```

**Requirements:**

- Socket.dev account (free tier available)

**Usage:**

- Scan dependencies: `mcp__socket__depscore`
- Identify vulnerabilities
- Check package quality

---

### Cloudflare Docs – Integration Tools

**Purpose:** Cloudflare documentation and integration

```bash
claude mcp add --transport http cloudflare-docs https://docs.mcp.cloudflare.com/mcp
```

**Requirements:**

- Cloudflare account (OAuth)

**Usage:**

- Search Cloudflare documentation
- Configure Workers, Pages, R2, D1

---

### DeepL – Translation Services

**Purpose:** Professional translation for i18n/localization

```bash
claude mcp add --transport http deepl https://mcp.deepl.com/mcp \
  --header "Authorization: Bearer <YOUR_DEEPL_API_KEY>"
```

**Requirements:**

- DeepL API key from [deepl.com/pro-account/keys](https://www.deepl.com/pro-account/keys)

**Usage:**

- Translate strings and files
- Support i18n workflows
- Multiple language pairs

---

## Local STDIO MCPs

These servers run locally as processes. No internet required for operation.

### Docker – Container Management

**Purpose:** Control Docker containers locally

```bash
claude mcp add-json docker '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@docker/mcp-server"]
}'
```

**Requirements:**

- Docker installed and running

**Usage:**

- Manage containers
- Build images
- Docker Compose operations

---

### Git – Repository Operations

**Purpose:** Local Git operations on current repository

```bash
claude mcp add-json git '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@cyanheads/git-mcp-server@latest"]
}'
```

**Requirements:**

- Node.js ≥18
- Git installed

**Usage:**

- Commit changes
- Create branches
- View history
- Manage remotes

---

### PostgreSQL – Local Database

**Purpose:** Query local or networked PostgreSQL databases

```bash
claude mcp add-json postgresql '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgresql"],
  "env": {
    "DATABASE_URL": "postgresql://user:password@localhost:5432/hospeda"
  }
}'
```

**Requirements:**

- PostgreSQL server running
- Database credentials

**Usage:**

- Execute SQL queries
- Schema inspection
- Data manipulation

---

### Serena – Semantic Code Analysis

**Purpose:** Advanced code understanding and refactoring

```bash
claude mcp add-json serena '{
  "type": "stdio",
  "command": "uvx",
  "args": [
    "--from",
    "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--context",
    "ide-assistant",
    "--project",
    "$(pwd)"
  ]
}'
```

**Requirements:**

- Python ≥3.8
- `uvx` (Python package runner)

**Usage:**

- Semantic code search
- Symbol analysis
- Intelligent refactoring
- Cross-reference analysis

**Key Features:**

- Find symbols by name path
- Track symbol references
- Code structure analysis
- Refactoring operations

---

### Sequential Thinking – Problem Breakdown

**Purpose:** Break down complex problems sequentially

```bash
claude mcp add-json sequential-thinking '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
}'
```

**Usage:**

- Complex problem solving
- Step-by-step analysis
- Decision trees

---

### Chrome DevTools – Browser Automation

**Purpose:** Automate and debug Chrome browser

```bash
claude mcp add-json chrome-devtools '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "chrome-devtools-mcp"]
}'
```

**Requirements:**

- Google Chrome or Chromium
- Start Chrome with debugging enabled:

```bash
google-chrome --remote-debugging-port=9222
```

**Usage:**

- Browser automation
- E2E testing
- Performance profiling

---

### BrowserStack – Cross-Browser Testing

**Purpose:** Real browser testing across devices

```bash
claude mcp add-json browserstack '{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@browserstack/mcp-server@latest"],
  "env": {
    "BROWSERSTACK_USERNAME": "<YOUR_USERNAME>",
    "BROWSERSTACK_ACCESS_KEY": "<YOUR_ACCESS_KEY>"
  }
}'
```

**Requirements:**

- BrowserStack account and credentials

**Usage:**

- Cross-browser E2E tests
- Real device testing
- Compatibility checks

---

### Semgrep – Security Scanning

**Purpose:** Static code security analysis

```bash
claude mcp add-json semgrep '{
  "type": "stdio",
  "command": "semgrep",
  "args": ["mcp"]
}'
```

**Requirements:**

- Semgrep installed:

```bash
pip install semgrep
semgrep login
```

**Usage:**

- Vulnerability scanning
- Secret detection
- Security best practices
- Code quality checks

---

## Configuration

### Environment Variables

Create `.env.local` for sensitive credentials:

```bash
# Context7
CONTEXT7_API_KEY=your_key_here

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=your_token_here

# Neon
NEON_API_KEY=your_key_here

# DeepL
DEEPL_API_KEY=your_key_here

# BrowserStack
BROWSERSTACK_USERNAME=your_username
BROWSERSTACK_ACCESS_KEY=your_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda
```

**Security:**

- Never commit `.env.local` to git
- Use `.env.example` for documentation
- Rotate keys regularly

### Verification

After installation, verify MCPs are working:

```bash
# List all installed MCPs
claude mcp list

# Test specific MCP
claude --mcp-test context7
```

---

## Troubleshooting

### Common Issues

**MCP not found:**

```bash
# Reinstall
claude mcp remove <server-name>
claude mcp add ...
```

**Connection timeout:**

- Check internet connection (HTTP MCPs)
- Verify API keys are correct
- Check service status pages

**STDIO server crashes:**

- Verify Node.js/Python versions
- Check process logs
- Ensure dependencies are installed

**Permission errors:**

- Check file permissions
- Verify API key scopes
- Review OAuth permissions

### Logs

View MCP logs:

```bash
# Claude Code logs
cat ~/.config/claude-code/logs/mcp.log

# Individual server logs
claude mcp logs <server-name>
```

---

## Related Documentation

- [MCP Overview](.claude/docs/mcp-servers.md)
- [Notification System](.claude/docs/notification-installation.md)
- [Quick Start Guide](.claude/docs/quick-start.md)
- [System Maintenance](.claude/docs/system-maintenance.md)

**Official Resources:**

- [MCP Specification](https://modelcontextprotocol.io)
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Server Repository](https://github.com/modelcontextprotocol/servers)

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2024-10-31 | Initial comprehensive installation guide | @tech-lead | P-004 |
