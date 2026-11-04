/**
 * AuthContext - real Supabase Auth
 *
 * Uses Supabase anonymous sign-in so every visitor gets a real auth.users row
 * and a real UUID. That makes Row Level Security (auth.uid() = user_id) work
 * for every table without email confirmation during the demo.
 *
 * Requires: Supabase dashboard -> Authentication -> Sign In / Providers ->
 * "Allow anonymous sign-ins" turned ON.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Name shown in the UI (anonymous users have no email) */
  displayName: string;
  signIn: (displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ANON_DISABLED_MESSAGE =
  'Anonymous sign-ins are turned off in Supabase. Open the Supabase dashboard, go to Authentication > Sign In / Providers, turn on "Allow anonymous sign-ins", then try again.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Remove the old localStorage mock user so it can't shadow the real session
    localStorage.removeItem('mock_user');

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (displayName?: string) => {
    const name = displayName?.trim();
    const { data, error } = await supabase.auth.signInAnonymously(
      name ? { options: { data: { display_name: name } } } : undefined
    );

    if (error) {
      if (error.message.toLowerCase().includes('anonymous sign-ins are disabled')) {
        throw new Error(ANON_DISABLED_MESSAGE);
      }
      throw new Error(error.message);
    }

    setSession(data.session);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const user = session?.user ?? null;
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) || user?.email || 'Guest';

  return (
    <AuthContext.Provider value={{ user, session, loading, displayName, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Signed-in user's id for pages inside <ProtectedRoute> (always signed in there).
 * Returns '' only during the brief moment before the session loads.
 */
export function useUserId(): string {
  return useAuth().user?.id ?? '';
}

/**
 * Get the signed-in user's id outside React components (lib code, stores).
 * Throws a clear error instead of silently writing with a fake id.
 */
export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in. Please sign in again.');
  return id;
}
