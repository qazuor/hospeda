# Changelog

All notable changes to the Hospeda project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.0.1] - 2024-10-31

### Added

- **Monorepo Structure**: TurboRepo with PNPM workspaces
- **Database Layer**: PostgreSQL with Drizzle ORM
- **API Backend**: Hono framework with TypeScript
- **Frontend Apps**:
  - Public web: Astro with React 19 islands
  - Admin dashboard: TanStack Start
- **Shared Packages**:
  - `@repo/db`: Database models and schemas
  - `@repo/schemas`: Zod validation schemas
  - `@repo/service-core`: Business logic services
  - `@repo/utils`: Shared utilities
  - `@repo/logger`: Centralized logging
  - `@repo/config`: Environment configuration
- **Testing Infrastructure**: Vitest with 90% coverage requirement
- **Code Quality**: Biome for linting and formatting
- **Authentication**: Clerk integration
- **Payments**: Mercado Pago integration
- **Development Environment**:
  - Docker Compose for local PostgreSQL
  - Hot Module Replacement (HMR)
  - TypeScript strict mode
- **Claude Code System**:
  - 13 specialized AI agents (Product, Engineering, Quality, Design, Specialized)
  - 18 commands organized by category (Planning, Quality, Development, Meta, Audit)
  - 16 skills for specialized capabilities
  - 3-level workflow system (Quick Fix, Atomic Task, Feature Planning)
- **Automated Validation**:
  - 7 JSON schemas (PDR, tech-analysis, TODOs, agents, commands, skills, code-registry)
  - Validation scripts (structure, documentation, registry)
  - Health check system with 7 automated checks
  - Git hooks (pre-commit, post-checkout) with Husky
  - CI/CD pipeline with GitHub Actions
- **Code Registry System**: Centralized planning code management
- **Checkpoint System**: Cross-device workflow with automatic progress tracking
- **Telemetry System**: Task timing tracking and velocity calculation
- **Comprehensive Documentation**:
  - Quick start guide (15-minute onboarding)
  - Glossary with all terminology
  - 9 workflow guides
  - 8 learning files
  - 4 system diagrams (Mermaid)
  - System maintenance procedures
  - Design standards (colors, typography, spacing, components)

---

## Links

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
- [Project Documentation](./.claude/docs/INDEX.md)
- [Quick Start Guide](./.claude/docs/quick-start.md)

---

**Note:** For detailed feature-specific changelogs, see individual planning session CHANGELOG.md files in `.claude/sessions/planning/P-XXX-*/CHANGELOG.md`
