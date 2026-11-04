/**
 * Your profile: who you are and where you're heading, in a few fields.
 *
 * Every Ropi answer reads this (Talk, explanations, interview practice), so it
 * stays on your goal instead of guessing. Kept in this browser, per account.
 * Your goal itself lives in useWeek (the planner uses it); this adds the rest.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useWeek } from './useWeek';

export interface Profile {
  /** The job you want next: "Project Manager" */
  targetRole: string;
  /** What you do now or did before: "Retail team lead, 6 years" */
  background: string;
  /** City, country */
  location: string;
  /** new | some | experienced (in the target field) */
  level: 'new' | 'some' | 'experienced' | '';
  /** A few lines in your own words (Ropi can draft it) */
  about: string;
  /** How you want answers: short, or with more detail */
  answerStyle: 'short' | 'detailed';
}

export const EMPTY_PROFILE: Profile = { targetRole: '', background: '', location: '', level: '', about: '', answerStyle: 'short' };

interface ProfileStore {
  ownerId: string | null;
  profile: Profile;
  set: (patch: Partial<Profile>) => void;
  claim: (userId: string) => void;
}

export const useProfile = create<ProfileStore>()(
  persist(
    (set, get) => ({
      ownerId: null,
      profile: EMPTY_PROFILE,
      set: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      // A different account in this browser starts empty
      claim: (userId) => {
        if (get().ownerId !== userId) set({ ownerId: userId, profile: EMPTY_PROFILE });
      },
    }),
    { name: 'ropi-profile-v1' }
  )
);

const LEVEL = { new: 'new to it', some: 'some experience in it', experienced: 'experienced in it', '': '' } as const;

/**
 * One paragraph about the user for any prompt: goal, target role, background.
 * Empty fields are left out, so nothing is made up about them.
 */
export function profileForPrompt(): string {
  const p = useProfile.getState().profile;
  const goal = useWeek.getState().goal?.title;
  const parts = [
    goal ? `Their goal: ${goal}.` : '',
    p.targetRole ? `They want to work as: ${p.targetRole}${p.level ? ` (${LEVEL[p.level]})` : ''}.` : '',
    p.background ? `Background: ${p.background}.` : '',
    p.location ? `Based in: ${p.location}.` : '',
    p.about ? `In their words: ${p.about.slice(0, 400)}` : '',
  ].filter(Boolean);
  return parts.length ? `About the user (use it to tailor the answer; don't repeat it back): ${parts.join(' ')}` : '';
}

/** How long answers should be */
export const answerStyle = () => useProfile.getState().profile.answerStyle;
