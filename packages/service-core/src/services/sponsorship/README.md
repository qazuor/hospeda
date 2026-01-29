# Sponsorship Services

This directory contains services for managing sponsorship-related entities in the Hospeda platform.

## Services

### SponsorshipLevelService

Manages sponsorship levels (tiers) that define different sponsorship packages available.

**Entity**: `SponsorshipLevel`
**Model**: `SponsorshipLevelModel`
**Permissions Used**:

- `SPONSORSHIP_CREATE`
- `SPONSORSHIP_UPDATE`
- `SPONSORSHIP_DELETE`
- `SPONSORSHIP_VIEW`
- `SPONSORSHIP_RESTORE`
- `SPONSORSHIP_HARD_DELETE`

### SponsorshipPackageService

Manages sponsorship packages that bundle multiple sponsorship benefits.

**Entity**: `SponsorshipPackage`
**Model**: `SponsorshipPackageModel`
**Permissions Used**: Same as SponsorshipLevelService

**Default Relations**: `{ eventLevel: true }`

### SponsorshipService

Manages individual sponsorship contracts/agreements between sponsors and targets.

**Entity**: `Sponsorship`
**Model**: `SponsorshipModel`
**Permissions Used**: Same as SponsorshipLevelService

**Default Relations**: `{ sponsorUser: true, level: true, package: true }`

## Usage Example

```typescript
import { SponsorshipService } from '@repo/service-core';

const sponsorshipService = new SponsorshipService({ logger });

// Create a new sponsorship
const result = await sponsorshipService.create(actor, {
  sponsorUserId: 'user-id',
  targetType: 'event',
  targetId: 'event-id',
  levelId: 'level-id',
  startsAt: new Date(),
  endsAt: new Date('2025-12-31')
});

// Search sponsorships
const sponsorships = await sponsorshipService.search(actor, {
  status: 'active',
  page: 1,
  limit: 20
});
```

## Notes

- All services extend `BaseCrudService` and follow the project's service pattern
- All permission checks use granular permissions (never role checks)
- All services use the RO-RO pattern (Receive Object, Return Object)
- Named exports only (no default exports)
