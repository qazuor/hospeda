# @repo/ai-image-generation

Generic AI-powered image generation package with multi-provider support.

## Overview

This package provides a flexible, extensible system for generating images using AI providers like Replicate, OpenAI, Stability AI, and more. It's designed to be provider-agnostic and use-case flexible.

## Installation

This package is internal to the Hospeda monorepo and installed via workspace protocol:

```json
{
  "dependencies": {
    "@repo/ai-image-generation": "workspace:*"
  }
}
```

## Quick Start

### 1. Environment Configuration

Set required environment variables:

```bash
# Required
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional (defaults to flux-schnell)
REPLICATE_MODEL=black-forest-labs/flux-schnell
```

### 2. Load Configuration

```ts
import { loadEnvConfig } from '@repo/ai-image-generation';

const config = loadEnvConfig();
console.log(config.replicateApiToken); // r8_...
console.log(config.replicateModel); // black-forest-labs/flux-schnell
```

## Features

- ✅ **Multi-Provider Support**: Extensible provider interface (Replicate, OpenAI, etc.)
- ✅ **Type-Safe Configuration**: Zod-based validation with TypeScript types
- ✅ **Environment Validation**: Clear error messages for missing/invalid config
- 🚧 **Template System**: Handlebars templates for structured prompts (coming soon)
- 🚧 **Image Processing**: Sharp-based compression, resizing, format conversion (coming soon)
- 🚧 **Metadata Management**: JSON registry for generated images (coming soon)

## Current Status

**Phase 1: Setup** ✅ Complete

- [x] Package structure
- [x] Environment configuration with Zod validation
- [x] Dependencies installed (Replicate SDK, Sharp)
- [x] Tests (90%+ coverage)

**Phase 2: Core Implementation** 🚧 In Progress

- [ ] Provider interface and Replicate implementation
- [ ] Template system with Handlebars
- [ ] Image processing with Sharp
- [ ] Metadata management
- [ ] Main ImageGenerator class

## Dependencies

- `replicate@^0.25.0` - Replicate API client
- `sharp@^0.32.0` - Image processing
- `zod@^3.22.4` - Schema validation

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REPLICATE_API_TOKEN` | ✅ Yes | - | Replicate API authentication token |
| `REPLICATE_MODEL` | ❌ No | `black-forest-labs/flux-schnell` | Replicate model to use |

## Usage Examples

### Basic Configuration

```ts
import { loadEnvConfig } from '@repo/ai-image-generation';

try {
  const config = loadEnvConfig();
  console.log('Configuration loaded successfully');
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}
```

### With Custom Model

```bash
export REPLICATE_API_TOKEN=r8_your_token_here
export REPLICATE_MODEL=black-forest-labs/flux-dev
```

```ts
const config = loadEnvConfig();
// config.replicateModel === "black-forest-labs/flux-dev"
```

## Error Handling

The package throws clear, actionable errors:

```ts
// Missing API token
loadEnvConfig();
// Error: REPLICATE_API_TOKEN environment variable is required

// Empty model string
process.env.REPLICATE_MODEL = '';
loadEnvConfig();
// Error: REPLICATE_MODEL must be a non-empty string
```

## Architecture

```
packages/ai-image-generation/
├── src/
│   ├── config/           # Environment configuration
│   │   ├── env-config.ts
│   │   └── index.ts
│   └── index.ts          # Main exports
├── test/
│   └── config/           # Configuration tests
│       └── env-config.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Future Plans

1. **Provider System** - Abstract provider interface for multiple AI services
2. **Template Engine** - Handlebars-based prompt templates
3. **Image Processing** - Compression, resizing, format conversion
4. **Metadata Registry** - Track generated images with metadata
5. **Main Generator** - High-level ImageGenerator class

## Contributing

This package follows the Hospeda project standards:

- Named exports only (no default exports)
- Tests in `test/` folder mirroring `src/` structure
- 90%+ test coverage requirement
- TDD approach (tests first)
- TypeScript strict mode
- Comprehensive JSDoc comments

## License

Private package for Hospeda project.
