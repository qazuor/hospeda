# MCPs Installation Commands

## Official HTTP MCPs (via claude mcp add)

### Context7 – Live documentation from code (requires API key)

claude mcp add --transport http context7 [https://mcp.context7.com/mcp](https://mcp.context7.com/mcp) --header "CONTEXT7_API_KEY: <YOUR_CONTEXT7_API_KEY>"

### Linear – Task and issue tracking (Linear)

claude mcp add --transport http linear [https://mcp.linear.app/mcp](https://mcp.linear.app/mcp)

### GitHub – GitHub integration (PRs, issues)

claude mcp add --transport http github [https://api.githubcopilot.com/mcp/](https://api.githubcopilot.com/mcp/)

### Mercado Pago – Payment processing (Mercado Pago API)

claude mcp add --transport http mercadopago [https://mcp.mercadopago.com/mcp](https://mcp.mercadopago.com/mcp) --header "Authorization: Bearer <YOUR_ACCESS_TOKEN>"

### Sentry – Production error monitoring (Sentry)

claude mcp add --transport http sentry [https://mcp.sentry.dev/mcp](https://mcp.sentry.dev/mcp)

### Vercel – Project and deployment management (Vercel)

claude mcp add --transport http vercel [https://mcp.vercel.com/](https://mcp.vercel.com/)

### Neon – Cloud PostgreSQL database (Neon)

claude mcp add --transport http neon [https://mcp.neon.tech/mcp](https://mcp.neon.tech/mcp) --header "Authorization: Bearer <YOUR_NEON_API_KEY>"

### Socket – Dependency security analysis (Socket.dev)

claude mcp add --transport http socket [https://mcp.socket.dev/](https://mcp.socket.dev/)

### Cloudflare (Docs) – Cloudflare integration tools (via OAuth)

claude mcp add --transport http cloudflare-docs [https://docs.mcp.cloudflare.com/mcp](https://docs.mcp.cloudflare.com/mcp)

### DeepL – Translation and i18n workflows

claude mcp add --transport http deepl [https://mcp.deepl.com/mcp](https://mcp.deepl.com/mcp) --header "Authorization: Bearer <YOUR_DEEPL_API_KEY>"

**Requirements:** DeepL account and API key (from [https://www.deepl.com/pro-account/keys](https://www.deepl.com/pro-account/keys)).
**Usage:** Useful for translating strings and text files, ideal for i18n/localization flows.

## Local MCPs (STDIO) via claude mcp add-json

### Docker – Local container control (requires Docker CLI)

claude mcp add-json docker '{"type":"stdio","command":"npx","args":["-y","@docker/mcp-server"]}'

### File System – Local file access (scoped to a directory)

claude mcp add-json filesystem '{"type":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/path/to/your/project"]}'

### Git – Local Git operations (current repo, requires Node 18+)

claude mcp add-json git '{"type":"stdio","command":"npx","args":["-y","@cyanheads/git-mcp-server@latest"]}'

### PostgreSQL – Postgres queries (local/networked)

claude mcp add-json postgresql '{"type":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-postgresql"],"env":{"DATABASE_URL":"postgresql://user:password@localhost:5432/db"}}'

### Persistent Memory – Knowledge and state persistence

claude mcp add-json memory '{"type":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-memory"],"env":{"MEMORY_FILE_PATH":"/home/user/claude_memory.jsonl"}}'

### Serena – Semantic code analysis (Serena MCP toolkit)

claude mcp add-json serena '{"type":"stdio","command":"uvx","args":["--from","git+[https://github.com/oraios/serena","serena","start-mcp-server","--context","ide-assistant","--project","$(pwd)](https://github.com/oraios/serena%22,%22serena%22,%22start-mcp-server%22,%22--context%22,%22ide-assistant%22,%22--project%22,%22$%28pwd%29)"]}'

### Sequential Thinking – Sequential breakdown of problems

claude mcp add-json sequential-thinking '{"type":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-sequential-thinking"]}'

### Chrome DevTools – Chrome browser automation/debugging

claude mcp add-json chrome-devtools '{"type":"stdio","command":"npx","args":["-y","chrome-devtools-mcp"]}'

**Requirements:** Google Chrome or Chromium installed. Start Chrome with:

```bash
google-chrome --remote-debugging-port=9222
```text

Claude will connect to Chrome on port `9222` using the DevTools protocol.

### BrowserStack – Real browser automation/testing

claude mcp add-json browserstack '{"type":"stdio","command":"npx","args":["-y","@browserstack/mcp-server@latest"],"env":{"BROWSERSTACK_USERNAME":"<YOUR_USERNAME>","BROWSERSTACK_ACCESS_KEY":"<YOUR_ACCESS_KEY>"}}'

**Requirements:** BrowserStack account and credentials. Internet access. Optional: log into the dashboard to inspect test logs.
**Usage:** Runs E2E tests on real devices, checks cross-browser compatibility and errors.

### Semgrep – Static code security analysis

claude mcp add-json semgrep '{"type":"stdio","command":"semgrep","args":["mcp"]}'

**Requirements:** `semgrep` installed locally:

```bash
pip install semgrep
semgrep login
```text

**Usage:** Claude can scan your repo for vulnerabilities, secrets, unsafe patterns and bad practices.

