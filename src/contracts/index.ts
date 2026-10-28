/**
 * CALISCOACHING MVP - TẬP HỢP TẤT CẢ HỢP ĐỒNG DỮ LIỆU & KIỂU
 * Điểm giao tiếp duy nhất cho Agent B, C, D, E, F.
 */

export * from './database.types';
export * from './profile.contract';
export * from './goal.contract';
export * from './observation.contract';
export * from './activity.contract';
export * from './program.contract';
export * from './review.contract';
export * from './consent.contract';
export * from './ai.contract';
export * from './idempotency';
export * from './health-profile.contract';
export * from './blood-pressure.contract';
export * from './daily-checkin.contract';
export * from './medical.contract';
export * from './health-document.contract';
export * from './group.contract';
export type { AgentADatabaseTypes, AgentAFunctionTypes } from './database-a.types';
export type { AgentBDatabaseTypes, AgentBFunctionTypes, WorkoutRunStatus, WorkoutSetStatus } from './database-b.types';
export type { AgentCDatabaseTypes, AgentCFunctionTypes } from './database-c.types';
export type { AgentDDatabaseTypes, AgentDFunctionTypes } from './database-d.types';
