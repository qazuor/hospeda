/**
 * logging.mockData.ts
 *
 * Mock data for logging util tests.
 */

import { getSafeActor } from './actor';

export const mockMethodName = 'testMethod';
export const mockInput = { foo: 'bar' };
export const mockOutput = { result: 42 };
export const mockActor = getSafeActor();
export const mockError = new Error('Test error');
export const mockPermission = 'TEST_PERMISSION';
export const mockEntity = { id: 'entity-1', name: 'Test Entity' };
export const mockReason = 'Test reason';
