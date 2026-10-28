import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/contracts/database.types';
import type { AgentADatabaseTypes, Json } from '@/contracts/database-a.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentADatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & AgentADatabaseTypes;
    Functions: Database['public']['Functions'] & {
      commit_capture_batch: {
        Args: {
          p_idempotency_key: string;
          p_payload_hash: string;
          p_activities?: Json;
          p_daily_checkin?: Json;
          p_observations?: Json;
        };
        Returns: Json;
      };
    };
  };
};

export async function getAgentASupabaseClient(): Promise<SupabaseClient<AgentADatabase> | null> {
  const client = await createServerSupabaseClient();
  return client as unknown as SupabaseClient<AgentADatabase> | null;
}
