/**
 * Supabase Database Client
 * 
 * Provides database operations for ROPI system
 */

// Use the ONE shared client: it carries the signed-in session. A second
// createClient() here had no session, so Row Level Security rejected its writes.
import { supabase } from '@/lib/supabase';

export { supabase };

/**
 * Save schedule recalculation to replan_log table
 */
export async function saveReplanLog(data: {
  userId: string;
  trigger: string;
  beforeSchedule: any;
  afterSchedule: any;
  durationMs: number;
  changesSummary: string;
}) {
  try {
    const { data: result, error } = await supabase
      .from('replan_log')
      .insert({
        user_id: data.userId,
        trigger: data.trigger,
        before_schedule: data.beforeSchedule,
        after_schedule: data.afterSchedule,
        duration_ms: data.durationMs,
        changes_summary: data.changesSummary,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving replan log:', error);
      return null;
    }

    return result;
  } catch (error) {
    console.error('Error saving replan log:', error);
    return null;
  }
}

/**
 * Get recent replan logs
 */
export async function getReplanLogs(userId: string, limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('replan_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching replan logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching replan logs:', error);
    return [];
  }
}
