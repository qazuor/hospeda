/**
 * Example usage of the Tracking System
 *
 * This example demonstrates how to use the tracking system to manage
 * planning tasks and code comments synchronization with GitHub Issues.
 */

import { TrackingManager } from '../src/tracking';

async function trackingExample() {
    // Initialize tracking manager with file path
    const manager = new TrackingManager('.github-workflow/tracking.json');

    // Load existing tracking data (or create new empty database)
    await manager.load();

    console.info('=== Adding Tracking Records ===\n');

    // Add a planning task record
    const planningTask = await manager.addRecord({
        type: 'planning-task',
        source: {
            sessionId: 'P-003',
            taskId: 'T-003-006'
        },
        status: 'pending',
        syncAttempts: 0
    });

    console.info(`Added planning task: ${planningTask.id}`);
    console.info(`  Session: ${planningTask.source.sessionId}`);
    console.info(`  Task: ${planningTask.source.taskId}`);
    console.info(`  Status: ${planningTask.status}\n`);

    // Add a code comment record
    const codeComment = await manager.addRecord({
        type: 'code-comment',
        source: {
            commentId: 'TODO-123',
            filePath: 'src/tracking/tracking-manager.ts',
            lineNumber: 42
        },
        status: 'pending',
        syncAttempts: 0
    });

    console.info(`Added code comment: ${codeComment.id}`);
    console.info(`  File: ${codeComment.source.filePath}:${codeComment.source.lineNumber}`);
    console.info(`  Status: ${codeComment.status}\n`);

    console.info('=== Marking as Synced ===\n');

    // Mark planning task as synced with GitHub
    const synced = await manager.markAsSynced(
        planningTask.id,
        42,
        'https://github.com/hospeda/main/issues/42'
    );

    console.info(`Synced planning task: ${synced.id}`);
    console.info(`  GitHub Issue: #${synced.github?.issueNumber}`);
    console.info(`  URL: ${synced.github?.issueUrl}`);
    console.info(`  Synced at: ${synced.lastSyncedAt}\n`);

    console.info('=== Querying Records ===\n');

    // Find by different criteria
    const foundById = await manager.findById(planningTask.id);
    console.info(`Found by ID: ${foundById?.id}`);

    const foundByTask = await manager.findByTaskId('T-003-006');
    console.info(`Found by task ID: ${foundByTask?.id}`);

    const foundByIssue = await manager.findByIssueNumber(42);
    console.info(`Found by issue #42: ${foundByIssue?.id}`);

    const pending = await manager.getRecordsByStatus('pending');
    console.info(`Pending records: ${pending.length}`);

    const sessionRecords = await manager.getRecordsBySession('P-003');
    console.info(`P-003 session records: ${sessionRecords.length}\n`);

    console.info('=== Statistics ===\n');

    // Get statistics
    const stats = await manager.getStatistics();
    console.info(`Total records: ${stats.total}`);
    console.info('By status:');
    console.info(`  - Pending: ${stats.byStatus.pending}`);
    console.info(`  - Synced: ${stats.byStatus.synced}`);
    console.info(`  - Updated: ${stats.byStatus.updated}`);
    console.info(`  - Failed: ${stats.byStatus.failed}`);
    console.info('By type:');
    console.info(`  - Planning tasks: ${stats.byType['planning-task']}`);
    console.info(`  - Code comments: ${stats.byType['code-comment']}`);
    console.info('By session:');
    for (const [sessionId, count] of Object.entries(stats.bySession)) {
        console.info(`  - ${sessionId}: ${count}`);
    }
    console.info();

    console.info('=== Updating Records ===\n');

    // Update a record
    const updated = await manager.updateRecord(codeComment.id, {
        status: 'updated',
        syncAttempts: 1
    });

    console.info(`Updated code comment: ${updated.id}`);
    console.info(`  New status: ${updated.status}`);
    console.info(`  Sync attempts: ${updated.syncAttempts}\n`);

    console.info('=== Error Handling ===\n');

    // Mark as failed
    const failed = await manager.markAsFailed(codeComment.id, 'GitHub API rate limit exceeded');

    console.info(`Marked as failed: ${failed.id}`);
    console.info(`  Error: ${failed.lastError}`);
    console.info(`  Attempts: ${failed.syncAttempts}\n`);

    // Reset failed records
    const reset = await manager.resetPending();
    console.info(`Reset ${reset.length} failed records to pending\n`);

    console.info('=== Persistence ===\n');

    // Save to disk (creates backup automatically)
    await manager.save();
    console.info('Tracking data saved to disk');
    console.info('Backup created: .github-workflow/tracking.json.bak\n');

    console.info('=== Cleanup ===\n');

    // Delete a record
    const deleted = await manager.deleteRecord(codeComment.id);
    console.info(`Deleted record: ${deleted ? 'Success' : 'Failed'}\n`);

    // Final save
    await manager.save();
    console.info('Final tracking data saved');
}

// Run example
trackingExample().catch(console.error);
