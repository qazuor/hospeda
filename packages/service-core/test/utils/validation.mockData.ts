/**
 * validation.mockData.ts
 *
 * Mock data for validation util tests.
 */

import { z } from 'zod';
import { getSafeActor } from './actor';

export const validActor = getSafeActor();
export const invalidActor = null;

export const validEntity = { id: 'entity-1', name: 'Valid Entity' };
export const invalidEntity = null;

export const validSchema = z.object({ foo: z.string() });
export const validInput = { foo: 'bar' };
export const invalidInput = { foo: 123 };
export const context = 'TestContext';
