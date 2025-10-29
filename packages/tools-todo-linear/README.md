# @repo/tools-todo-linear

> Automated TODO/HACK/DEBUG synchronization with Linear Issues

A powerful tool that automatically scans your codebase for TODO, HACK, and DEBUG comments and synchronizes them with Linear issues. Keep your code comments and project management in perfect sync.

## ✨ Features

- 🔍 **Smart Code Scanning**: Automatically finds TODO, HACK, and DEBUG comments in your codebase
- 🔄 **Bidirectional Sync**: Creates, updates, and archives Linear issues based on code changes
- 🏷️ **Smart Labeling**: Automatically applies labels based on comment type and file location
- 👤 **User Assignment**: Supports `@username` syntax for issue assignment
- 🎯 **IDE Integration**: Configurable deep-links to open files directly in your preferred IDE
- 📁 **Intelligent Filtering**: Respects gitignore and supports custom include/exclude patterns
- 🔒 **Safe Operations**: Preserves user-added content in Linear issues
- 📊 **Detailed Reporting**: Comprehensive sync reports with operation summaries
- 🤖 **AI Enhancement**: Intelligent analysis with priority, descriptions, and suggestions
- ⚡ **AI Optimization**: Efficient batch processing eliminates duplicate API calls (NEW!)

## ⚡ AI Processing Optimization (NEW!)

**The system now uses optimized batch processing to eliminate duplicate AI API calls and improve efficiency.**

### 🚫 Problem Solved: Duplicate AI Calls

**Before (Inefficient):**

```bash
🤖 Processing AI analysis for 132 comments...     # Batch processing
📦 Processing batch 1/27 (5 items)
📦 Processing batch 2/27 (5 items)
⚠️ AI analysis failed for new comment...          # Individual calls (DUPLICATE!)
⚠️ AI analysis failed for new comment...          # Individual calls (DUPLICATE!)
```

**After (Optimized):**

```bash
🤖 Processing AI analysis for 132 comments...     # Batch processing ONLY
📦 Processing batch 1/27 (5 items)
📦 Processing batch 2/27 (5 items)
✅ AI analysis completed for 22 comments          # No duplicate individual calls
```

### 🎯 Key Benefits

- **💰 50% Fewer API Calls**: Eliminates duplicate individual AI requests
- **⚡ Faster Processing**: No waiting for individual analysis after batch fails
- **🛡️ Better Rate Limiting**: Reduced chance of hitting provider limits
- **📊 Predictable Usage**: Only controlled batch processing
- **🔄 Graceful Degradation**: TODOs with failed AI get `PENDING` status for future retry

### 🔧 How It Works

1. **Batch Processing**: AI analyzes all TODOs in efficient batches
2. **Result Caching**: AI analysis results are stored and reused
3. **Issue Creation**: Uses cached AI analysis instead of making new calls
4. **Pending State**: Failed AI analyses are marked as `PENDING` for future syncs
5. **No Fallbacks**: Eliminates individual AI calls that caused duplicates

## 🤖 AI-Powered Analysis

Transform your TODO comments into comprehensive Linear issues with AI assistance:

### What AI Adds

- **🎯 Smart Prioritization**: Automatically determines urgency (Urgent/High/Normal/Low) based on code context and keywords
- **📝 Rich Descriptions**: Generates detailed explanations including:
  - **Why**: Explains the necessity and importance of the TODO
  - **How**: Provides implementation suggestions and approach
  - **Impact**: Describes potential effects on the codebase
- **🏷️ Intelligent Labels**: Adds relevant tags like "refactoring", "bug-fix", "feature", "performance"
- **⏱️ Effort Estimation**: Estimates work complexity (Small: 1-2h, Medium: 1-3d, Large: 1w+)
- **🔗 Related Files**: Suggests other files that might need changes
- **💡 Implementation Suggestions**: Provides specific coding recommendations

### ⚡ AI Processing Optimization (NEW!)

The system now uses **optimized batch processing** to eliminate duplicate AI API calls:

#### **Before Optimization**

- ❌ Batch processing for all TODOs
- ❌ Individual AI calls for each TODO creation/update
- ❌ **Double API usage** causing rate limits
- ❌ Slower processing and token waste

#### **After Optimization**

- ✅ **Single batch processing** only
- ✅ Pre-processed AI analysis reused for issue creation
- ✅ **50% fewer API calls**
- ✅ Better rate limit compliance
- ✅ Faster overall synchronization

#### **Benefits**

- **💰 Token Efficiency**: Eliminates duplicate AI requests
- **⚡ Speed**: Faster sync with fewer API bottlenecks
- **🛡️ Rate Limit Safety**: Reduced chance of hitting provider limits
- **📊 Predictable Usage**: Only batch calls, no surprise individual requests

### Supported AI Providers

| Provider | Models | Use Case | Free Quota | Cost |
|----------|--------|----------|------------|------|
| **🆓 DeepSeek** | deepseek-chat | Completely free, high limits | 10,000+ req/day | Free |
| **⚡ Groq** | llama-3.1-8b-instant, mixtral-8x7b-32768 | Ultra-fast responses | 6,000 tokens/min | Free |
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4 | Most comprehensive analysis | 3 RPM | Paid |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Haiku/Opus | Detailed reasoning | $5 credit | Paid |
| **Google Gemini** | Gemini 2.0 Flash, Gemini 1.5 Pro | Fast analysis and insights | 50 req/day | Limited |

### Getting API Keys

Each AI provider requires an API key for authentication:

#### 🔑 OpenAI

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your account
3. Click "Create new secret key"
4. Copy the generated API key
5. **Note**: OpenAI is paid service, requires billing setup

#### 🔑 Anthropic (Claude)

1. Visit [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Sign up or log in to your account
3. Go to Settings → API Keys
4. Click "Create Key"
5. Copy the generated API key
6. **Note**: Anthropic offers free tier with usage limits

#### 🔑 Google Gemini

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select a Google Cloud project or create new one
5. Copy the generated API key
6. **Note**: Gemini offers generous free tier

#### 🆓 DeepSeek (RECOMMENDED - FREE)

1. Visit [DeepSeek Platform](https://platform.deepseek.com/api_keys)
2. Sign up with email
3. Go to API Keys section
4. Create new API key
5. Copy the generated API key
6. **Note**: Completely free with very high limits (10,000+ requests/day)

#### ⚡ Groq (RECOMMENDED - FREE & FAST)

1. Visit [Groq Console](https://console.groq.com/keys)
2. Sign up with email or GitHub
3. Go to API Keys section
4. Create new API key
5. Copy the generated API key
6. **Note**: Free tier with 6,000 tokens/minute - ultra fast responses!

### AI Configuration

**Recommended providers (free with high quotas):**

- **DeepSeek**: 10,000+ requests/day, completely free
- **Groq**: 6,000 tokens/minute, ultra-fast and free

Configure during setup or manually in `.env`:

```bash
# Enable AI enhancement
TODO_LINEAR_AI_ENABLED=true
TODO_LINEAR_AI_PROVIDER=groq  # or deepseek, openai, anthropic, gemini
TODO_LINEAR_AI_LANGUAGE=es
TODO_LINEAR_AI_MODEL=llama-3.1-8b-instant  # Updated Groq model
TODO_LINEAR_AI_API_KEY=your_api_key_here
TODO_LINEAR_AI_MAX_CONTEXT_LINES=50

# Batch Processing Configuration (NEW!)
TODO_LINEAR_AI_BATCH_SIZE=3      # TODOs per AI request (1-20)
TODO_LINEAR_AI_DELAY_MS=3000     # Delay between requests (0-30000ms)
TODO_LINEAR_AI_MAX_RETRIES=3     # Max retry attempts (0-10)
```

### Batch Processing Configuration (NEW!)

Control how AI processes multiple TODOs for optimal performance and rate limiting:

#### **Batch Size (`TODO_LINEAR_AI_BATCH_SIZE`)**

- **Default**: 3 TODOs per request
- **Range**: 1-20
- **Description**: How many TODOs are analyzed in a single AI request
- **Recommendation**:
  - **Small batches (1-3)**: More reliable, better error isolation
  - **Large batches (5-10)**: Faster processing, fewer API calls
  - **Very large (10+)**: Risk of timeout, harder to debug failures

#### **Delay Between Requests (`TODO_LINEAR_AI_DELAY_MS`)**  

- **Default**: 3000ms (3 seconds)
- **Range**: 0-30000ms
- **Description**: Wait time between AI requests to respect rate limits
- **Recommendation**:
  - **Short delay (1000-2000ms)**: Faster processing, higher rate limit risk
  - **Medium delay (3000-5000ms)**: Balanced performance and safety
  - **Long delay (5000+ms)**: Very safe, slower processing

#### **Max Retries (`TODO_LINEAR_AI_MAX_RETRIES`)**

- **Default**: 3 attempts
- **Range**: 0-10
- **Description**: How many times to retry failed AI requests
- **Recommendation**:
  - **Low retries (1-2)**: Fail fast, manual intervention required
  - **Medium retries (3-5)**: Good balance of resilience and speed
  - **High retries (5+)**: Very resilient, may mask persistent issues

#### **Batch Processing Tips**

```text
Configuration Examples by Provider:

🆓 DeepSeek (High Quota):
  BATCH_SIZE=5
  DELAY_MS=1000  
  MAX_RETRIES=2

⚡ Groq (Ultra Fast):
  BATCH_SIZE=3
  DELAY_MS=2000
  MAX_RETRIES=3

💰 OpenAI (Paid, Rate Limited):
  BATCH_SIZE=2
  DELAY_MS=5000
  MAX_RETRIES=5
```

### Supported Languages

The AI can generate issue descriptions in multiple languages:

| Language | Code | Description |
|----------|------|-------------|
| **English** | `en` | Default language (fallback) |
| **Español** | `es` | Spanish language support |
| **Português** | `pt` | Portuguese language support |
| **Italiano** | `it` | Italian language support |
| **Deutsch** | `de` | German language support |

Example with Spanish:

```bash
TODO_LINEAR_AI_LANGUAGE=es
```

This will generate AI analysis in Spanish like:

- **Descripción**: "Por qué es necesario, cómo implementar, impacto esperado"
- **Etiquetas**: "refactoring", "rendimiento", "seguridad"
- **Sugerencias**: "Implementar cache Redis, usar patrón cache-aside"

### Example AI-Enhanced Issue

**Before (Plain TODO):**

```typescript
// TODO: Implement caching for user data
```

**After (AI-Enhanced Linear Issue):**

```markdown
Auto-generated by todo-linear-sync

---

Found in: [src/services/user.service.ts:45](vscode://file//src/services/user.service.ts:45)

Implement caching for user data

## 🤖 AI Analysis

**Priority:** High | **Effort:** Medium (1-3d)

**Why:** User data fetching is currently performed on every request, causing unnecessary database load and slower response times. Implementing caching will significantly improve application performance and reduce server costs.

**How:** Implement a Redis-based caching layer with TTL-based expiration. Use cache-aside pattern with automatic cache invalidation on user data updates. Consider implementing cache warming for frequently accessed user profiles.

**Impact:** Will reduce database queries by ~70% and improve API response times from ~200ms to ~50ms. Requires careful handling of cache invalidation to maintain data consistency.

**Suggestions:**
- Use Redis with 15-minute TTL for user profile data
- Implement cache invalidation on user updates
- Add cache hit/miss metrics for monitoring
- Consider implementing cache warming for VIP users

**Related Files:**
- src/services/user.service.ts
- src/config/redis.config.ts
- src/middleware/cache.middleware.ts

*AI Confidence: 92%*

---
```

## 🎨 Custom AI Prompts (NEW!)

> 🚀 **Completely customizable AI prompts** - Tailor the AI analysis to your team's specific needs and coding standards!

### Overview

The system now uses **file-based prompts** that you can fully customize. Instead of hardcoded AI instructions, each provider uses editable Markdown templates with variable placeholders.

### 📁 Prompt System Structure

```text
packages/tools-todo-linear/
└── prompts/
    ├── README.md                 # Complete customization guide
    ├── openai.example.md         # OpenAI template
    ├── anthropic.example.md      # Anthropic template  
    ├── gemini.example.md         # Google Gemini template
    ├── deepseek.example.md       # DeepSeek template
    └── groq.example.md          # Groq template
```

### 🛠️ How to Customize Prompts

#### Step 1: Copy Example Template

```bash
# Copy any provider's example template
cp prompts/openai.example.md prompts/openai.md
cp prompts/groq.example.md prompts/groq.md
```

#### Step 2: Edit Your Custom Prompt

Open the copied file and customize it with your team's standards:

```markdown
# Your Custom AI Prompt

You are an expert code analyst helping a tourism platform team.

Please analyze this TODO comment with focus on:
- **Security implications** for user data
- **Performance impact** on booking system
- **Mobile compatibility** considerations

Context: {{$filePath}} at line {{$lineNumber}}
Comment: {{$comment}}

Code before:
{{$beforeContext}}

Code after:  
{{$afterContext}}

Generate response in {{$languageInstructions}}.

Focus on {{$packageName}} package standards.
Consider these imports: {{$imports}}
```

#### Step 3: Use Variables

Available variables that get automatically replaced:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{$filePath}}` | Full file path | `/src/auth/auth.service.ts` |
| `{{$lineNumber}}` | Line number | `42` |
| `{{$comment}}` | TODO comment text | `Implement JWT refresh` |
| `{{$beforeContext}}` | Code before TODO | `class AuthService {` |
| `{{$afterContext}}` | Code after TODO | `return tokens;` |
| `{{$fileType}}` | File type | `typescript` |
| `{{$languageInstructions}}` | Language instructions | `Respond in Spanish` |
| `{{$packageName}}` | Package name | `@repo/auth` |
| `{{$imports}}` | File imports | `express, jwt, bcrypt` |

#### Step 4: Automatic Detection

The system automatically detects and uses your custom prompts:

- ✅ **Custom prompt found**: Uses `prompts/openai.md`
- 📄 **No custom prompt**: Falls back to `prompts/openai.example.md`

### 🎯 Advanced Customization Examples

#### Team-Specific Standards

```markdown
# DevOps Team Prompt

You are a DevOps expert for a Kubernetes-based tourism platform.

Analyze this TODO with focus on:
- **Container scaling** implications
- **CI/CD pipeline** impact  
- **Infrastructure costs**
- **Security vulnerabilities**

TODO: {{$comment}}
File: {{$filePath}}:{{$lineNumber}}

Provide specific Kubernetes manifests and Terraform changes needed.
```

#### Language-Specific Analysis

```markdown
# TypeScript Expert Prompt

Analyze this TypeScript TODO focusing on:
- **Type safety** improvements
- **Generic constraints** needed
- **Interface segregation** opportunities
- **Dependency injection** patterns

Context: {{$beforeContext}}
TODO: {{$comment}}
After: {{$afterContext}}

Suggest specific TypeScript patterns and decorators.
```

#### Business Domain Focus

```markdown
# Hospitality Business Expert

You understand hotel booking systems, tourism workflows, and guest experience.

Analyze this TODO considering:
- **Guest experience** impact
- **Booking conversion** effects
- **Revenue optimization** opportunities
- **Compliance requirements** (GDPR, PCI)

TODO: {{$comment}} in {{$packageName}}
```

### 🧪 Testing Your Custom Prompts

```bash
# Build and test the prompt system
cd packages/tools-todo-linear
npm run build
node dist/scripts/test-prompts-simple.js
```

Expected output:

```text
Available prompts:
  openai: CUSTOM      ✅ (using your custom prompt)
  anthropic: EXAMPLE  📄 (using default example)
  groq: CUSTOM        ✅ (using your custom prompt)

✅ Prompt generation working
🎉 Basic test completed!
```

### 🔄 Prompt Fallback System

The system uses intelligent fallback:

1. **Primary**: `prompts/{provider}.md` (your custom prompt)
2. **Fallback**: `prompts/{provider}.example.md` (default template)
3. **Error**: Graceful degradation with minimal prompt

### 📚 Benefits of Custom Prompts

- **🎯 Domain-Specific**: Tailor analysis to your business domain
- **🏢 Team Standards**: Enforce coding conventions and practices  
- **🌍 Language Localization**: Get AI responses in your preferred language
- **🔧 Technical Focus**: Emphasize specific technologies (React, Node.js, Docker)
- **📊 Consistent Output**: Standardize AI analysis format across your team

### 💡 Prompt Best Practices

1. **Be Specific**: Define exact analysis criteria
2. **Use Context**: Leverage all available variables
3. **Set Expectations**: Specify output format and detail level
4. **Include Examples**: Show desired response patterns
5. **Test Variations**: Try different approaches for best results

### 🔗 Sharing Prompts

You can share your custom prompts with your team:

```bash
# Share your team's custom prompts
cp prompts/openai.md shared-prompts/team-openai.md
cp prompts/groq.md shared-prompts/team-groq.md

# Team members can use them
```bash
# Team members can use them
cp shared-prompts/team-openai.md prompts/openai.md
```

### 🔧 Technical Implementation

The prompt system is powered by the **PromptManager** class with advanced features:

#### Features

- **🚀 Automatic Caching**: Prompts are cached for better performance
- **🔄 Hot Reloading**: Changes to prompt files are detected automatically  
- **🛡️ Error Handling**: Graceful fallback if prompts are invalid
- **📊 Variable Validation**: Ensures all placeholders are properly replaced
- **🎯 Batch Processing**: Optimized for multiple TODO analysis

#### Developer API

```typescript
import { promptManager } from './ai/prompt-manager.js';

// Generate single prompt
const prompt = await promptManager.generatePrompt(
    'openai',           // Provider
    filePath,           // File path
    lineNumber,         // Line number  
    comment,            // TODO comment
    beforeContext,      // Code before
    afterContext,       // Code after
    'typescript',       // File type
    'es',              // Language (en/es/pt/it/de)
    '@repo/auth',      // Package name
    'express,jwt'      // Imports
);

// Generate batch prompt (multiple TODOs)
const batchPrompt = await promptManager.generateBatchPrompt(
    'groq',            // Provider
    contexts,          // Array of CodeContext
    'en'              // Language
);

// List available prompts
const available = await promptManager.listAvailablePrompts();
// Returns: [{ provider: 'openai', custom: true, example: true }, ...]

// Clear cache (for testing)
promptManager.clearCache();
```

#### Advanced Configuration

Create `prompts.config.ts` for advanced settings:

```typescript
// prompts.config.ts (optional)
export default {
  cacheEnabled: true,
  maxCacheSize: 100,
  variablePrefix: '{{$',
  variableSuffix: '}}',
  fallbackToExample: true,
  validateVariables: true
};
```

## 🚀 Quick Start

```

## 🚀 Quick Start

### 1. Installation

```bash
# The package is already included in the hospeda monorepo
# No additional installation required
```

### 2. Initial Setup

Run the interactive setup to configure Linear integration:

```bash
pnpm todo:setup
```

This will prompt you for:

- **Linear API Key**: Get from Linear → Settings → API → Create new token
- **Linear Team ID**: Get from Linear → Team Settings → General → Team ID  
- **Default User Email**: Email for assigning TODOs when no @user specified
- **IDE Label Name** (optional): Custom label name (default: "From IDE")
- **IDE Link Template** (optional): Custom link format for your IDE

### 3. Start Syncing

```bash
# One-time sync
pnpm todo:sync

# Watch mode (auto-sync on file changes)
pnpm todo:watch

# Clean up orphaned issues
pnpm todo:clean
```

## 📝 Comment Syntax

### Basic TODO Comments

```typescript
// TODO: Implement user authentication
// HACK: Temporary fix for Safari bug
// DEBUG: Remove this console.log before production
```

### Advanced Syntax

```typescript
// TODO @john.doe: Review this implementation
// TODO #performance: Optimize database queries  
// HACK: Workaround for API rate limiting - needs proper solution
```

**Syntax Rules:**

- `@username`: Assigns issue to specific user (must match Linear user email)
- `#label`: Adds custom label to the issue
- `:` separates the directive from the description

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LINEAR_API_KEY` | ✅ | - | Linear API authentication key |
| `LINEAR_TEAM_ID` | ✅ | - | Linear team identifier |
| `TODO_LINEAR_DEFAULT_USER_EMAIL` | ✅ | - | Default assignee email |
| `TODO_LINEAR_IDE_LABEL_NAME` | ❌ | `"From IDE"` | Label name for IDE-generated issues |
| `TODO_LINEAR_IDE_LINK_TEMPLATE` | ❌ | `"vscode://file//{filePath}:{lineNumber}"` | IDE link template |
| `TODO_LINEAR_AI_ENABLED` | ❌ | `false` | Enable AI enhancement |
| `TODO_LINEAR_AI_PROVIDER` | ❌ | `disabled` | AI provider (openai/anthropic/gemini) |
| `TODO_LINEAR_AI_LANGUAGE` | ❌ | `en` | AI language (en/es/pt/it/de) |
| `TODO_LINEAR_AI_MODEL` | ❌ | Provider default | AI model to use |
| `TODO_LINEAR_AI_API_KEY` | ❌ | - | API key for external AI providers |
| `TODO_LINEAR_AI_BASE_URL` | ❌ | Provider default | Base URL (for custom endpoints) |
| `TODO_LINEAR_AI_MAX_CONTEXT_LINES` | ❌ | `50` | Lines of code context around TODO |
| `TODO_LINEAR_AI_BATCH_SIZE` | ❌ | `3` | TODOs processed per AI request |
| `TODO_LINEAR_AI_DELAY_MS` | ❌ | `3000` | Milliseconds delay between AI requests |
| `TODO_LINEAR_AI_MAX_RETRIES` | ❌ | `3` | Maximum retry attempts on AI errors |

### IDE Link Templates

The `TODO_LINEAR_IDE_LINK_TEMPLATE` supports various IDEs:

**Visual Studio Code:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="vscode://file//{filePath}:{lineNumber}"
```

**JetBrains IDEs (IntelliJ, WebStorm, etc.):**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="jetbrains://idea/navigate/reference?project=hospeda&path={filePath}:{lineNumber}"
```

**Sublime Text:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="subl://{filePath}:{lineNumber}"
```

**Vim/Neovim:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="nvim://{filePath}:{lineNumber}"
```

**Custom Protocol:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="myeditor://open?file={filePath}&line={lineNumber}"
```

**Placeholders:**

- `{filePath}`: Absolute file path
- `{lineNumber}`: Line number where comment is found

## 🛠️ Commands

### `pnpm todo:setup`

Interactive setup wizard with provider selection and quota information:

```
🤖 Choose AI Provider:
   Providers ordered by generosity (free quota first):

   1. DeepSeek Chat
      Quota: 10,000+ requests/day
      Cost: 🆓 COMPLETELY FREE
      Speed: Very Fast

   2. Groq (Llama 3)
      Quota: 6,000 tokens/minute
      Cost: 🆓 COMPLETELY FREE
      Speed: ⚡ ULTRA FAST

   3. OpenAI GPT-4
      Quota: 3 RPM (free tier)
      Cost: Paid after $5 credit
      Speed: Fast
```

The setup automatically:

- Shows providers ordered by generosity (free first)
- Displays quota and cost information
- Provides API key links for each provider
- Configures language preferences (en/es/pt/it/de)
- Sets up default models for each provider

### `pnpm todo:sync`

Interactive setup wizard for initial configuration.

```bash
pnpm todo:setup
```

### `pnpm todo:sync`

Performs a one-time synchronization of all TODO comments.

```bash
pnpm todo:sync

# Options:
pnpm todo:sync --verbose    # Detailed logging
pnpm todo:sync --dry-run    # Preview changes without applying
```

### `pnpm todo:watch`

Continuous monitoring mode that syncs changes in real-time.

```bash
pnpm todo:watch

# Features:
# - Watches for file changes
# - Automatically syncs new/modified/deleted TODOs
# - Respects debouncing to avoid excessive API calls
```

### `pnpm todo:clean`

Cleans up orphaned Linear issues (issues that no longer have corresponding code comments).

```bash
pnpm todo:clean              # Interactive cleanup
pnpm todo:clean --all        # Clean all orphaned issues
pnpm todo:clean --issue-id ISSUE_ID  # Clean specific issue
```

### `pnpm todo:ai-stats` (NEW!)

Shows AI analysis statistics for all tracked TODOs.

```bash
pnpm todo:ai-stats
```

**Example output:**

```text
📊 AI Analysis Statistics
========================

📝 Total TODOs: 132
✅ Completed: 127
⏳ Pending: 2
⚠️  Failed: 3
❌ Disabled: 0
⏭️  Skipped: 0

🔄 Failed TODOs will be retried in next sync

⚠️  Recent failed AI analyses:
   • apps/admin/src/components/fields/ImageField.tsx:104 - Show error toast
     Error: Rate limit reached for model qwen/qwen3-32b...
```

### `pnpm todo:test-prompts` (NEW!)

Tests the custom prompt system to verify everything is working correctly.

```bash
# Build and test prompt system
cd packages/tools-todo-linear
npm run build
node dist/scripts/test-prompts-simple.js
```

**Example output:**

```text
🧪 Testing prompt system...

Available prompts:
  openai: CUSTOM      ✅ (using your custom prompt)
  anthropic: EXAMPLE  📄 (using default template)
  groq: CUSTOM        ✅ (using your custom prompt)
  deepseek: EXAMPLE   📄 (using default template)
  gemini: EXAMPLE     📄 (using default template)

✅ Prompt generation working
🎉 Basic test completed!

To customize prompts:
1. Copy: cp prompts/openai.example.md prompts/openai.md
2. Edit the copied file
3. System will use custom prompts automatically
```

**Advanced testing:**

```bash
# Full comprehensive test
node dist/scripts/test-prompts.js

# Tests include:
# - Variable replacement verification
# - Batch prompt generation
# - Cache system performance
# - Fallback mechanism validation
# - All provider compatibility
```

## 📊 Sync Process

### What Gets Synced

1. **New Comments** → Creates Linear issues
2. **Modified Comments** → Updates existing Linear issues  
3. **Deleted Comments** → Archives Linear issues
4. **Moved Comments** → Updates file location in Linear

### Issue Content Structure

Each Linear issue created contains:

```markdown
Auto-generated by todo-linear-sync

---

Found in: [src/components/Button.tsx:42](vscode://file//project/src/components/Button.tsx:42)

Implement proper error handling for API calls

## 🤖 AI Analysis

**Priority:** High | **Effort:** Medium (1-3d)

**Why:** User data fetching is currently performed on every request...

**How:** Implement a Redis-based caching layer with TTL-based expiration...

**Impact:** Will reduce database queries by ~70% and improve API response times...

---

## DEV NOTES:

<!-- User content below this line is preserved -->
Additional notes added in Linear...
```

**Sections:**

- **Auto-generated marker**: Identifies tool-managed content
- **First separator**: Divides header from content  
- **File Link**: Clickable link to open file in your IDE
- **Description**: Comment content from code
- **AI Analysis**: Enhanced analysis when AI is enabled
- **Second separator**: Divides tool content from user content
- **DEV NOTES**: Section for user-added content (preserved during updates)

## 🔄 Updating Existing TODOs with AI

If you have TODOs that were synchronized **before** enabling AI, you can update them to receive AI analysis:

### Method 1: Clean and Re-sync Individual TODOs

```bash
# Clean specific TODO by ID
pnpm todo:clean --id abc-123-def-456

# Re-sync to apply AI analysis
pnpm todo:sync
```

### Method 2: Clean Multiple TODOs

```bash
# Clean several TODOs
pnpm todo:clean --id first-id-here
pnpm todo:clean --id second-id-here
pnpm todo:clean --id third-id-here

# Re-sync all at once
pnpm todo:sync
```

### Method 3: Clean by Category

```bash
# Clean TODOs with specific labels (example: security issues)
# Find IDs first, then clean them:
grep -r "TODO.*#security" . --include="*.ts" --include="*.tsx"
pnpm todo:clean --id found-security-id-1
pnpm todo:clean --id found-security-id-2
pnpm todo:sync
```

### Method 4: Complete Reset (Use with Caution)

```bash
# WARNING: This removes ALL TODO tracking and requires full re-sync
pnpm todo:clean --all

# Re-sync everything (will take time with AI enabled)
pnpm todo:sync
```

**Recommendation**: Process TODOs in small batches (5-10 at a time) to avoid API rate limits and monitor progress.

## 🛠️ Error Handling

The system provides user-friendly error messages for common issues:

### API Quota Errors

**Before (Raw Error):**

```text
Gemini API error: 429 Too Many Requests - {"error":{"code":429,"message":"You exceeded your current quota..."}}
```

**After (Friendly Error):**

```text
Gemini API error: 429 Too Many Requests - You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 50. Please retry in 59 seconds.
```

### Common Error Solutions

| Error | Provider | Solution |
|-------|----------|----------|
| **Insufficient Balance** | DeepSeek | Check API key validity or try Groq |
| **Model not found** | Groq | Use llama-3.1-8b-instant or mixtral-8x7b-32768 |
| **Quota exceeded** | OpenAI | Check billing, add credits |
| **Credit balance too low** | Anthropic | Visit Plans & Billing |
| **Invalid API key** | Gemini | Create new key at AI Studio |
| **Rate limit** | All | Wait and retry, consider free providers |

**💡 Pro Tip**: Use DeepSeek or Groq for unlimited free usage!

## 🏷️ Automatic Labels

The tool automatically applies labels based on:

### Comment Type

- `TODO` → Red label
- `HACK` → Orange label  
- `DEBUG` → Green label

### File Location

- `apps/api/**` → "Apps: API"
- `apps/web/**` → "Apps: Web"
- `apps/admin/**` → "Apps: Admin"
- `packages/**` → "Packages: [package-name]"

### IDE Source

- All issues get the configured IDE label (default: "From IDE")

### Custom Labels

- Use `#label-name` syntax in comments for custom labels

## 📁 File Scanning

### Included by Default

- TypeScript/JavaScript files (`*.ts`, `*.tsx`, `*.js`, `*.jsx`)
- JSON configuration files (`*.json`)
- Markdown documentation (`*.md`)
- Configuration files (`*.config.*`)

### Excluded by Default

- `node_modules/`
- `.git/`
- `dist/`, `build/`, `out/`
- `.turbo/`, `.next/`
- Binary files
- Generated files

### Custom Patterns

Configure scanning in your project root:

```typescript
// todo-linear.config.ts
export default {
  includePatterns: [
    'src/**/*.{ts,tsx,js,jsx}',
    'docs/**/*.md',
    '*.config.{js,ts}'
  ],
  excludePatterns: [
    'src/generated/**',
    '**/*.test.{ts,js}',
    'src/legacy/**'
  ]
};
```

## 🤖 AI Tracking & Retry System

The system now tracks AI analysis state locally, eliminating the need to check Linear for failed analyses and improving sync performance.

### AI States

- **⏳ PENDING**: Needs AI analysis (new TODOs or retries)
- **✅ COMPLETED**: Successfully analyzed by AI
- **⚠️ FAILED**: AI analysis failed, will retry next sync
- **❌ DISABLED**: Too many failures, AI analysis disabled for this TODO
- **⏭️ SKIPPED**: AI globally disabled

### Retry Logic

AI analysis automatically retries based on error type:

- **Rate limits**: Up to 3 retries
- **Quota exceeded**: Up to 2 retries  
- **Invalid API key**: No retry (immediate disable)
- **Generic errors**: Up to 3 retries

### Tracking File

AI state is stored in `.todo-linear-tracking.json`:

```json
{
  "comments": [
    {
      "linearId": "abc-123-def",
      "filePath": "src/component.ts",
      "line": 42,
      "title": "Implement feature X",
      "aiState": "COMPLETED",
      "aiRetryCount": 0,
      "aiLastError": null
    }
  ]
}
```

### Performance Benefits

- **No Linear queries** for AI status during sync
- **Instant retry detection** without API calls
- **Efficient batch processing** of pending analyses
- **Local failure tracking** with detailed error messages

### Removed Limitations

- **24-hour retry cooldown removed**: TODOs retry immediately on next sync
- **Flexible scheduling**: Perfect for infrequent commit-based syncs
- **No time-based restrictions**: Only retry count matters

## 🔄 Sync States

### Issue States in Linear

- **Todo**: Active TODO comment in code
- **In Progress**: User manually changed state
- **Done**: User marked as completed
- **Canceled**: Comment removed from code (archived)

### Sync Operations

| Code Change | Linear Action | Issue State |
|-------------|---------------|-------------|
| Add TODO | Create issue | Todo |
| Modify TODO | Update issue | Unchanged |
| Move TODO | Update location | Unchanged |
| Delete TODO | Archive issue | Canceled |
| Restore TODO | Reactivate issue | Todo |

## 🚨 Troubleshooting

### Common Issues

**"Missing required configuration" Error:**

```bash
# Run setup again
pnpm todo:setup

# Check environment variables
cat .env | grep TODO_LINEAR
```

**"Failed to create issue" Error:**

- Verify Linear API key has correct permissions
- Check team ID is correct
- Ensure default user email exists in Linear workspace

**No TODOs Found:**

- Check file patterns are correct
- Verify files aren't in excluded directories
- Use `--verbose` flag to see scanning details

**IDE Links Not Working:**

- Verify your IDE supports custom URL schemes
- Check the link template syntax
- Test with a simple `vscode://` link first

**Custom Prompts Not Working:**

```bash
# Test prompt system
cd packages/tools-todo-linear
npm run build
node dist/scripts/test-prompts-simple.js

# Check file existence
ls -la prompts/

# Verify custom prompt format
cat prompts/openai.md  # Should not contain {{$ variables after processing

# Clear cache and retry
# (PromptManager automatically clears cache on file changes)
```

**AI Analysis Missing or Incorrect:**

- Check your custom prompt has all required variables
- Verify variable syntax: `{{$variableName}}` (exact format required)
- Test with example prompt first: `mv prompts/openai.md prompts/openai.backup.md`
- Check AI provider API key and quota limits

**Variables Not Replaced in Prompts:**

```bash
# Common issues:
# ❌ Wrong: {$variableName}
# ❌ Wrong: {{variableName}}  
# ❌ Wrong: {{$variable_name}}
# ✅ Correct: {{$variableName}}

# Test variable replacement:
node dist/scripts/test-prompts-simple.js
# Should show "✅ Prompt generation working"
```

### Debug Mode

Enable verbose logging for detailed information:

```bash
DEBUG=1 pnpm todo:sync --verbose
```

### Log Files

Sync logs are stored in:

```text
.todo-linear/
├── tracking.json     # Tracked comments database
├── sync.log         # Operation history
└── errors.log       # Error details
```

## 🔐 Security

### API Key Safety

- Store API keys in `.env.local` (gitignored)
- Never commit API keys to version control
- Use environment-specific keys for different deployments

### Permissions Required

The Linear API key needs:

- `Read` access to issues and teams
- `Write` access to create and update issues
- `Admin` access to create labels (optional)

## 🤝 Contributing

### Development Setup

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build --filter=@repo/tools-todo-linear

# Run in development
pnpm dev --filter=@repo/tools-todo-linear
```

### Testing

```bash
# Run tests
pnpm test --filter=@repo/tools-todo-linear

# Test with sample project
pnpm todo:sync --dry-run --verbose

# Test prompt system
cd packages/tools-todo-linear
npm run build
node dist/scripts/test-prompts-simple.js

# Test AI integration
TODO_LINEAR_AI_ENABLED=true TODO_LINEAR_AI_PROVIDER=groq pnpm todo:sync --dry-run
```

### Developing Custom Prompts

```bash
# Create new prompt template
cp prompts/openai.example.md prompts/my-custom.example.md

# Edit the template with your variables
# Test the changes
npm run build
node dist/scripts/test-prompts-simple.js

# Validate variable replacement
grep -o '{{$[^}]*}}' prompts/my-custom.example.md
# Should list all variables used

# Test with real AI provider
TODO_LINEAR_AI_PROVIDER=my-custom pnpm todo:sync --dry-run
```

### Adding New AI Providers

1. Create prompt template: `prompts/newprovider.example.md`
2. Add provider configuration in `src/ai/providers/`
3. Register provider in `src/ai/factory.ts`
4. Update setup wizard in `src/scripts/setup.ts`
5. Add tests for the new provider

### Prompt System Architecture

```text
src/ai/
├── prompt-manager.ts         # Core prompt management
├── types.ts                 # Type definitions
├── providers/               # AI provider implementations
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── groq.ts
│   └── ...
├── factory.ts              # Provider factory
└── utils.ts                # Utilities

prompts/
├── README.md               # User documentation
├── {provider}.example.md   # Default templates
└── {provider}.md          # User customizations (gitignored)
```

## 📚 Examples

### Example Project Structure

```text
src/
├── components/
│   ├── Button.tsx        # TODO: Add loading state
│   └── Modal.tsx         # HACK @sarah: Fix z-index issue
├── services/
│   └── api.ts           # DEBUG: Remove console.logs
└── utils/
    └── helpers.ts       # TODO #performance: Optimize sorting
```

### Generated Linear Issues

Each comment becomes a Linear issue with:

- **Title**: Comment description
- **Labels**: Type + Location + IDE + Custom
- **Assignee**: Specified user or default
- **Description**: File location with clickable link
- **Project**: Auto-assigned to team project

## 📊 Provider Recommendations

### For Most Users (Free & Unlimited)

**🥇 Groq**: Ultra-fast responses, 6,000 tokens/minute free
**🥈 DeepSeek**: Highest free quota, 10,000+ requests/day

### For Enterprise/Premium Analysis

**🔥 OpenAI GPT-4**: Most comprehensive analysis (paid)
**⚡ Anthropic Claude**: Best reasoning capabilities (paid)

### Quick Start Recommendation

```bash
# Best free option for most users
TODO_LINEAR_AI_PROVIDER=groq
TODO_LINEAR_AI_LANGUAGE=es  # or your preferred language
```

## 📄 License

Part of the hospeda monorepo. See root LICENSE file.

## 🆘 Support

For issues and questions:

1. Check this README first
2. Search existing issues in the hospeda repository
3. Create a new issue with detailed reproduction steps
4. Use `--verbose` flag and include log output

## 📅 Recent Updates

### v2.1.0 - October 2025

- ⚡ **AI Processing Optimization**: Eliminated duplicate AI API calls
- 🔄 **Batch Processing Only**: Removed individual AI analysis fallbacks
- 💰 **50% Token Reduction**: More efficient API usage
- 🛡️ **Better Rate Limiting**: Improved compliance with provider limits
- 📊 **Enhanced Logging**: Clearer indication of AI processing state
- 🏷️ **Label Cache Optimization**: Pre-warming to avoid duplicate creation errors

### v2.0.0 - September 2025

- 🤖 **Custom AI Prompts**: Fully customizable file-based prompt system
- 🆓 **Free AI Providers**: Added DeepSeek and Groq support
- 📊 **AI Statistics**: New `todo:ai-stats` command
- 🔄 **AI Retry System**: Improved local tracking and retry logic
- 🌍 **Multi-language**: Spanish, Portuguese, Italian, German support
- ⚙️ **Batch Configuration**: Customizable batch sizes and delays

---

## 📋 TODO - Future Improvements

### 🔧 Core Functionality

- [ ] **Improve Label Duplicate Handling**: Better detection and resolution of duplicate label creation errors
- [ ] **Linear Rate Limiting Enhancement**: Implement exponential backoff and request batching to better handle Linear API limits
- [ ] **Issue Update Optimization**: Cache issue content to avoid fetching existing data when only AI analysis changes
- [ ] **Orphan Issue Detection**: Better cleanup system for issues that no longer have corresponding TODO comments
- [ ] **Batch Update Operations**: Group multiple Linear API updates into single transactions

### 🤖 AI Processing

- [ ] **Streaming AI Responses**: Support for streaming responses to improve perceived performance
- [ ] **AI Provider Fallback**: Automatic fallback to secondary AI providers when primary fails
- [ ] **Context-Aware Analysis**: Include more file context (imports, function signatures) for better AI analysis
- [ ] **AI Analysis Caching**: Cache AI analysis results based on comment content hash to avoid reprocessing
- [ ] **Custom AI Models**: Support for custom fine-tuned models for project-specific analysis

### 📊 Analytics & Monitoring

- [ ] **Performance Metrics Dashboard**: Track sync performance, AI usage, and success rates over time
- [ ] **Cost Tracking**: Monitor AI API usage costs across different providers
- [ ] **Success Rate Analytics**: Track comment analysis success rates by file type and complexity
- [ ] **Linear Workspace Integration**: Better tracking of Linear team metrics and issue lifecycle

### 🛠️ Developer Experience

- [ ] **Interactive Setup Wizard**: Guided configuration setup with validation and testing
- [ ] **Config File Templates**: Pre-built configurations for common project types
- [ ] **VS Code Extension**: Direct integration with editor for inline TODO management
- [ ] **GitHub Actions Integration**: Pre-built workflows for CI/CD integration
- [ ] **Hot Reload Configuration**: Dynamic config updates without restart
- [ ] **Mandatory Initial Sync**: Make first sync during setup mandatory (not optional) with conservative settings (batch size: 1, delay: 4s) to prevent rate limiting failures

### 🔐 Security & Reliability

- [ ] **API Key Rotation**: Support for automatic API key rotation and management
- [ ] **Backup & Recovery**: System state backup and rollback capabilities
- [ ] **Error Recovery**: Better recovery from partial sync failures
- [ ] **Audit Logging**: Comprehensive audit trail for all operations
- [ ] **Webhook Support**: Real-time notifications for sync events and failures

### 🌐 Platform & Integration

- [ ] **Multiple Linear Teams**: Support for syncing across multiple Linear teams/workspaces
- [ ] **Project Templates**: Pre-configured setups for different project types (React, Node.js, etc.)
- [ ] **Custom File Parsers**: Support for additional file formats and comment styles
- [ ] **Integration Testing**: Comprehensive test suite for Linear and AI provider integrations
- [ ] **Docker Support**: Containerized deployment options

### 🎯 Priority Improvements

- [ ] **Smart Sync**: Only process files that have changed since last sync
- [ ] **Parallel Processing**: Process multiple files/comments in parallel for better performance
- [ ] **Progressive Enhancement**: Graceful degradation when services are unavailable
- [ ] **Configuration Validation**: Runtime validation of all configuration options

---

Made with ❤️ for the hospeda team
