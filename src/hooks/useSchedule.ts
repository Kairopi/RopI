/**
 * useSchedule - the changes the user made to this week.
 *
 * Stores only inputs, never the computed schedule:
 *   constraints  LifeShift sentences, applied in order on top of each other
 *   adjustments  decisions from conflict suggestions ("skip X", "do 15 min")
 * Pages call usePlan() to get a fresh schedule relative to now.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Adjustment, Constraint } from '@/lib/scheduling/types';

interface ScheduleStore {
  constraints: Constraint[];
  adjustments: Adjustment[];
  lastTrigger: string | null;
  /** epoch ms of the last recalculation (numbers survive JSON persistence) */
  lastRecalculatedAt: number | null;
  addConstraint: (constraint: Constraint) => void;
  addAdjustments: (adjustments: Adjustment[], label: string) => void;
  removeAdjustment: (index: number) => void;
  reset: () => void;
}

export const useSchedule = create<ScheduleStore>()(
  persist(
    (set) => ({
      constraints: [],
      adjustments: [],
      lastTrigger: null,
      lastRecalculatedAt: null,

      addConstraint: (constraint) =>
        set((state) => ({
          constraints: [...state.constraints, constraint],
          lastTrigger: constraint.description,
          lastRecalculatedAt: Date.now(),
        })),

      addAdjustments: (adjustments, label) =>
        set((state) => ({
          adjustments: [
            ...state.adjustments.filter((a) => !adjustments.some((n) => n.taskId === a.taskId)),
            ...adjustments,
          ],
          lastTrigger: label,
          lastRecalculatedAt: Date.now(),
        })),

      removeAdjustment: (index) =>
        set((state) => ({
          adjustments: state.adjustments.filter((_, i) => i !== index),
          lastRecalculatedAt: Date.now(),
        })),

      reset: () => set({ constraints: [], adjustments: [], lastTrigger: null, lastRecalculatedAt: null }),
    }),
    {
      name: 'ropi-lifeshift-v2',
      partialize: (state) => ({
        constraints: state.constraints,
        adjustments: state.adjustments,
        lastTrigger: state.lastTrigger,
        lastRecalculatedAt: state.lastRecalculatedAt,
      }),
    }
  )
);
