import 'server-only';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
export async function getOwnedWorkoutDraft(runId?:string) {
  if (!runId || !/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const {user}=await requireAuthenticatedUser();
  const db=await createServerSupabaseClient();
  if (!db) return null;
  const {data,error}=await db.from('workout_runs').select('id,session_title,completed_at').eq('id',runId).eq('user_id',user.id).eq('status','completed').maybeSingle();
  if (error || !data) return null;
  return {runId:data.id,title:data.session_title,content:`Duy trì luyện tập: ${data.session_title}`.slice(0,500),notes:`Đã hoàn thành buổi tập “${data.session_title}” lúc ${data.completed_at}. Tự cập nhật tiến độ cam kết sau khi kiểm tra.`};
}
