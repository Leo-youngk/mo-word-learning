import type { StudyPhase } from '../types';

const VALID_PHASES: StudyPhase[] = ['review', 'round1', 'round2', 'round3', 'round4', 'summary'];

export function validatePhaseValue(phase: string): phase is StudyPhase {
  return VALID_PHASES.includes(phase as StudyPhase);
}
