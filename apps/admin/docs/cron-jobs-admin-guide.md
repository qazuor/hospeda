# Cron Jobs Admin Panel Guide

## Overview

The cron jobs admin panel allows managing and monitoring scheduled tasks from the Hospeda administration interface.

## Location

- **Route**: `/billing/cron`
- **Menu**: Billing - Scheduled Tasks

## Features

### 1. Job Visualization

Displays all registered cron jobs in the system with:

- **Name**: Unique job identifier
- **Description**: Explanation of what the job does
- **Schedule**: When it runs (e.g., "Daily at midnight")
- **Status**: Active or Disabled

### 2. System Statistics

Panel with key metrics:

- Total scheduled tasks
- Active tasks
- Disabled tasks

### 3. Manual Execution

For each active job, you can:

- **Execute manually**: "Run now" button
- **Dry Run mode**: Toggle to run in test mode without making real changes
- **View results**: Detailed information after execution

### 4. Execution Results

After running a job, the following is displayed:

- Status: Success or Error
- Descriptive message
- Records processed
- Errors found
- Duration in milliseconds
- Execution mode (Test or Real)

### 5. Auto-refresh

- The job list refreshes automatically every minute
- Visual indicator when refreshing

## File Structure

```
apps/admin/src/features/cron-jobs/
├── components/
│   ├── CronJobCard.tsx        # Individual job card
│   └── CronJobsPanel.tsx      # Main panel
├── hooks.ts                   # TanStack Query hooks
├── types.ts                   # TypeScript definitions
└── index.ts                   # Barrel exports
```

## API Endpoints Used

### GET /api/v1/cron

Lists all registered cron jobs.

**Response:**

```typescript
{
  success: true,
  data: {
    jobs: CronJob[],
    totalJobs: number,
    enabledJobs: number
  }
}
```

### POST /api/v1/cron/:jobName

Executes a cron job manually.

**Query params:**

- `dryRun` (optional): If "true", runs in test mode

**Response:**

```typescript
{
  success: true,
  data: {
    success: boolean,
    message: string,
    processed: number,
    errors: number,
    durationMs: number,
    jobName: string,
    dryRun: boolean,
    executedAt: string
  }
}
```

## TypeScript Types

### CronJob

```typescript
interface CronJob {
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
}
```

### CronJobResult

```typescript
interface CronJobResult {
  success: boolean;
  message: string;
  processed: number;
  errors: number;
  durationMs: number;
  jobName: string;
  dryRun: boolean;
  executedAt: string;
}
```

## Available Hooks

### useCronJobsQuery()

Fetches the list of all cron jobs.

```typescript
const { data, isLoading, error } = useCronJobsQuery();
```

**Features:**

- Stale time: 5 minutes
- Refetch interval: 1 minute (auto-refresh)

### useTriggerCronJobMutation()

Executes a cron job manually.

```typescript
const { mutate, isPending } = useTriggerCronJobMutation();

mutate(
  { jobName: 'cleanup-sessions', dryRun: true },
  {
    onSuccess: (response) => {
      console.log(response.data);
    }
  }
);
```

## Components

### CronJobCard

Card that displays an individual cron job with manual execution capability.

**Props:**

```typescript
interface CronJobCardProps {
  job: CronJob;
}
```

**Features:**

- Displays job information
- Dry Run mode toggle
- Manual execution button
- Shows last result
- Loading and error states

### CronJobsPanel

Main panel that displays all jobs and statistics.

**Features:**

- System statistics
- List of all jobs
- Auto-refresh with indicator
- Loading, error, and empty states

## Permissions

Access to this page is protected by admin authentication. Only authenticated users with admin panel access can view and use this functionality.

## Important Notes

1. **Dry Run**: Always enabled by default to prevent accidental changes
2. **Disabled jobs**: Cannot be executed manually
3. **Auto-refresh**: The list updates automatically; no need to reload the page
4. **Errors**: Displayed clearly with descriptive messages

## Use Cases

### Run a job in test mode

1. Go to `/billing/cron`
2. Find the desired job
3. Verify that "Test mode (Dry Run)" is enabled
4. Click "Run now"
5. View results on the card

### Run a job in real mode

1. Go to `/billing/cron`
2. Find the desired job
3. Disable the "Test mode (Dry Run)" toggle
4. Click "Run now"
5. Confirm that you understand this will make real changes
6. View results on the card

### Monitor system status

1. Go to `/billing/cron`
2. Review the statistics cards at the top
3. See which jobs are active/disabled
4. The page refreshes automatically every minute

## Troubleshooting

### Job does not appear in the list

- Verify that the job is registered in `apps/api/src/cron/registry.ts`
- Verify that the API server is running
- Check the browser console for errors

### Cannot execute a job

- Verify that the job is enabled
- Verify that the API is responding
- Check authentication permissions

### Results are not showing

- Check the API response in the Network tab
- Review errors in the console
- Verify that the `/api/v1/cron/:jobName` endpoint is working

## Future Development

Possible improvements:

- Execution history
- Performance charts
- Error notifications
- Dynamic job scheduling
- Detailed per-execution logs
