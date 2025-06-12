// global.d.ts

import type { createMockDb, createMockDbLogger } from './setupTest';

declare global {
    var mockDb: ReturnType<typeof createMockDb>;
    var mockDbLogger: ReturnType<typeof createMockDbLogger>;
}
