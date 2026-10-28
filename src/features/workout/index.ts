/**
 * CALISCOACHING - WORKOUT FEATURE (AGENT B - D3)
 * Public Exports cho Dashboard, Programs và các Agent khác.
 */

export * from './contracts/workout.contract';
export * from './hooks/workout-storage';
export * from './hooks/useWorkoutTimer';
export * from './hooks/useWorkoutOutbox';
export * from './server/workout-actions';
export * from './server/workout-adapter';

// Components
export { ActiveWorkoutView } from './components/ActiveWorkoutView';
export { ExerciseSetRow } from './components/ExerciseSetRow';
export { PreviousRecordBadge } from './components/PreviousRecordBadge';
export { ResumeWorkoutCard } from './components/ResumeWorkoutCard';
export { WorkoutResultSummary } from './components/WorkoutResultSummary';
export { IncompleteSetsModal } from './components/IncompleteSetsModal';
