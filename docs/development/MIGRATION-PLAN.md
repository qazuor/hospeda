# Migration Plan - docs/development/

**Status**: Pending Migration
**Created**: 2025-11-04
**Related**: PB-002.6

---

## Overview

This directory contains legacy documentation that needs to be reviewed, updated, and migrated to the new documentation structure defined in P-002.

## Files to Migrate

### 1. adding-services.md (13K)

**Current Content**: Guide for adding new services to the monorepo
**Target Location**: `/docs/guides/adding-new-entity.md`
**Migration Task**: Will be covered in PB-007 (End-to-End Tutorial)
**Status**: Keep temporarily
**Action Required**:

- Review and update for current architecture patterns
- Integrate with new BaseModel/BaseCrudService patterns
- Add TDD workflow integration
- Migrate to new guides structure

---

### 2. cli-utilities.md (16K)

**Current Content**: Documentation of CLI tools and scripts
**Target Location**: `/docs/guides/cli-utilities.md`
**Migration Task**: PB-046 (Cross-cutting Guides Batch 2)
**Status**: Keep temporarily
**Action Required**:

- Audit all CLI commands for accuracy
- Update with new monorepo scripts
- Add examples for common workflows
- Migrate to guides section

---

### 3. database-setup.md (6.3K)

**Current Content**: PostgreSQL setup and configuration guide
**Target Location**: `/docs/getting-started/database-setup.md`
**Migration Task**: PB-003 (Getting Started - Prerequisites & Installation)
**Status**: Keep temporarily
**Action Required**:

- Update for current Docker setup
- Add Neon cloud database option
- Integrate with installation workflow
- Migrate to getting-started section

---

### 4. docker-deployment.md (9K)

**Current Content**: Docker and deployment configuration
**Target Location**: `/docs/deployment/docker.md`
**Migration Task**: PB-033 (Deployment Overview & Environments)
**Status**: Keep temporarily
**Action Required**:

- Update for current Fly.io deployment
- Add production deployment steps
- Document environment variables
- Migrate to deployment section

---

### 5. markdown-formatting.md (5K)

**Current Content**: Markdown formatting standards and tools
**Target Location**: `/docs/contributing/markdown-style.md`
**Migration Task**: PB-041 (Contributing Documentation)
**Status**: Keep temporarily - VALUABLE CONTENT
**Action Required**:

- Update with current markdownlint-cli2 config
- Add new formatting rules from `.markdownlint-cli2.jsonc`
- Document lint-staged integration
- Migrate to contributing section

**Note**: This file contains useful formatting standards that should be preserved

---

### 6. planning-linear-sync.md (9K)

**Current Content**: Planning and Linear integration workflow
**Target Location**: `/docs/guides/planning-workflow.md`
**Migration Task**: PB-046 (Cross-cutting Guides Batch 2)
**Status**: Keep temporarily - VALUABLE CONTENT
**Action Required**:

- Update for current GitHub workflow integration
- Document new planning-sync scripts
- Add workflow diagrams
- Migrate to guides section

**Note**: This file contains current workflow documentation that's actively used

---

### 7. testing-guide.md (14K)

**Current Content**: Testing strategies and patterns
**Target Location**: `/docs/testing/testing-guide.md`
**Migration Task**: PB-038 (Testing Documentation)
**Status**: Keep temporarily
**Action Required**:

- Update for current Vitest configuration
- Add TDD workflow integration
- Document 90% coverage requirement
- Add testing patterns and examples
- Migrate to testing section

---

### 8. README.md (11K)

**Current Content**: Old development guide index
**Target Location**: N/A (replaced by new structure)
**Migration Task**: N/A
**Status**: ✅ DELETED in PB-002.6
**Action Required**: None - content covered in new structure

---

## Migration Priority

### High Priority (Actively Used)

1. `planning-linear-sync.md` - Current workflow documentation
2. `markdown-formatting.md` - Current formatting standards

### Medium Priority (Useful Reference)

1. `testing-guide.md` - Testing patterns
2. `adding-services.md` - Entity creation guide
3. `database-setup.md` - Database configuration

### Low Priority (Can be Rewritten)

1. `cli-utilities.md` - CLI reference
2. `docker-deployment.md` - Deployment guide

---

## Next Steps

1. **Keep all files in place** until their target locations are created
2. **Update references** in existing documentation to point to new locations
3. **Migrate content** as part of respective PB tasks
4. **Delete originals** only after successful migration and verification

---

## Notes

- All files preserved to avoid losing valuable content
- Content will be modernized during migration
- Some content may be merged with new documentation
- Git history preserved for all changes

---

**Last Updated**: 2025-11-04 by PB-002.6
