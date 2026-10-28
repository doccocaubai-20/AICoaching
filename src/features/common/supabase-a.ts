import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/contracts/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentADatabase = Database;

export async function getAgentASupabaseClient(): Promise<SupabaseClient<Database> | null> {
  return await createServerSupabaseClient();
}
