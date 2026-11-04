import { calculateWeightedConfidence, classifyConcepts } from '@/lib/learning/skill-tracker';

export default async function () {
  const check = (label: string, got: unknown, want: unknown) =>
    console.log(`${JSON.stringify(got) === JSON.stringify(want) ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);

  check('first quiz = raw score', calculateWeightedConfidence(33.3, 0, 0), 33);
  check('second quiz 100% after 33', calculateWeightedConfidence(100, 33, 1), 80);
  check('third quiz 100% after 80', calculateWeightedConfidence(100, 80, 2), 94);
  check('drop: 0% after 94', calculateWeightedConfidence(0, 94, 3), 28);

  const stats = [
    { concept: 'cold starts', attempts: 2, correct: 0, accuracy: 0, lastAttempt: null, trend: 'stable' as const },
    { concept: 'pricing', attempts: 2, correct: 1, accuracy: 50, lastAttempt: null, trend: 'stable' as const },
    { concept: 'limits', attempts: 1, correct: 0, accuracy: 0, lastAttempt: null, trend: 'stable' as const },
    { concept: 'vpc', attempts: 3, correct: 3, accuracy: 100, lastAttempt: null, trend: 'stable' as const },
    { concept: 'iam', attempts: 2, correct: 2, accuracy: 100, lastAttempt: null, trend: 'stable' as const },
  ];
  const r = classifyConcepts(stats);
  check('weak = <50% with >=2 attempts', r.weakSpots, ['cold starts']);
  check('strong = >85% with >=3 attempts', r.strongSpots, ['vpc']);
}
