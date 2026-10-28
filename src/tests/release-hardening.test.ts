import { describe,it,expect,beforeAll,afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {hasWorkoutSetActual,isWorkoutSetIncomplete} from '@/features/workout/contracts/workout.contract';
import {signBriefPreview,verifyBriefPreview} from '@/features/briefs/contracts/preview-integrity';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const C='33333333-3333-3333-3333-333333333333';
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
let db:PGlite;
async function actor<T>(role:string,uid:string,fn:(tx:any)=>Promise<T>):Promise<T>{return db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);await tx.exec(`SET LOCAL ROLE ${role}`);return fn(tx);});}
beforeAll(async()=>{
 db=await PGlite.create({extensions:{pgcrypto}});
 const source=fs.readFileSync(path.resolve(__dirname,'agent-c-journey-media.test.ts'),'utf8');
 const stub=source.match(/const SUPABASE_STUB = `([\s\S]*?)`;/)![1];
 await db.exec(stub);
 await db.exec(`CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$select string_to_array($1,'/')$$; GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role; GRANT ALL ON storage.objects TO authenticated,service_role;`);
 const dir=path.resolve(__dirname,'../../supabase/migrations');
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 await db.query("insert into auth.users(id,email) values($1,'a@example.com'),($2,'b@example.com'),($3,'c@example.com')",[A,B,C]);
});
afterAll(async()=>{await db?.close();});
describe('Production release trust boundaries',()=>{
 it('rejects cross-owner share creation and preserves legitimate public sharing',async()=>{
  const brief:any=await actor('authenticated',A,tx=>tx.query(`insert into health_briefs(user_id,brief_type,title,date_range_start,date_range_end,snapshot_payload) values($1,'medical','Private','2026-10-01','2026-10-28','{"meta":{"title":"Private","user_id":"internal-owner"},"confirmationToken":"internal-token","sourceRefs":[{"sourceId":"internal-source"}],"workoutDetails":{"sessions":[{"sourceId":"internal-source","durationMinutes":15}]}}') returning id`,[A]));
  const id=brief.rows[0].id;
  await expect(actor('authenticated',B,tx=>tx.query(`insert into brief_shares(brief_id,user_id,token_hash,expires_at) values($1,$2,$3,now()+interval '1 day')`,[id,B,'cross-owner-hash-000000000000']))).rejects.toThrow();
  await actor('authenticated',A,tx=>tx.query(`insert into brief_shares(brief_id,user_id,token_hash,expires_at) values($1,$2,$3,now()+interval '1 day')`,[id,A,'valid-hash-00000000000000000']));
  const result:any=await actor('anon','',tx=>tx.query('select get_public_shared_brief($1) as data',['valid-hash-00000000000000000']));
  expect(result.rows[0].data.status).toBe('active');
  expect(result.rows[0].data.user_id).toBeUndefined();
  const serialized=JSON.stringify(result.rows[0].data);
  expect(serialized).not.toContain('internal-');
  expect(serialized).not.toContain('sourceId');
  expect(result.rows[0].data.snapshot.workoutDetails.sessions[0].durationMinutes).toBe(15);
 });
 it('rejects direct reservation inserts that bypass the quota RPC',async()=>{
  await expect(actor('authenticated',A,tx=>tx.query(`insert into journey_videos(user_id,exercise_id,variant_id,file_name,file_type,file_size_bytes,storage_path,status) values($1,'pull_up','standard','clip.mp4','video/mp4',20971520,$2,'reserved')`,[A,A+'/bypass.mp4']))).rejects.toThrow();
 });
});

describe('Storage quota and lifecycle',()=>{
 async function reserve(key:string,bytes=20971520) {
  const result:any=await actor('authenticated',C,tx=>tx.query(`select reserve_journey_video_upload($1,'dead_hang','active_grip',$2,'video/mp4',$3,$4,null) id`,[key,key+'.mp4',bytes,C+'/'+key+'.mp4']));
  return result.rows[0].id as string;
 }
 it('charges the maximum upload grant, serializes reservations, and blocks direct ledger/storage bypass',async()=>{
  for(let i=0;i<5;i++) await reserve('quota-'+i,1);
  await expect(reserve('quota-overflow',1)).rejects.toThrow(/quota exceeded/);
  const result:any=await actor('authenticated',C,tx=>tx.query(`delete from journey_videos where user_id=$1 returning id`,[C]));
  expect(result.rows).toHaveLength(0);
  await expect(actor('authenticated',C,tx=>tx.query(`insert into storage.objects(bucket_id,name,metadata) values('comparison_videos',$1,'{}')`,[C+'/quota-0.mp4']))).rejects.toThrow();
  await expect(actor('authenticated',C,tx=>tx.query(`update journey_videos set file_size_bytes=1,status='ready' where user_id=$1`,[C]))).rejects.toThrow();
 });
 it('reads actual stored bytes, keeps quota on pending/delete, and never trusts browser finalize metadata',async()=>{
  const id=await reserve('quota-0',1);
  await db.query(`insert into storage.objects(bucket_id,name,metadata) values('comparison_videos',$1,'{"size":20000000,"mimetype":"video/mp4"}')`,[C+'/quota-0.mp4']);
  await expect(actor('authenticated',C,tx=>tx.query(`select finalize_journey_video_upload($1,1,'video/mp4')`,[id]))).rejects.toThrow(/exceeds reserved size/);
  // Privileged fixture models a reservation created by the normal server action at the max size.
  await db.query('update journey_videos set file_size_bytes=20971520 where id=$1',[id]);
  await actor('authenticated',C,tx=>tx.query(`select finalize_journey_video_upload($1,1,'text/plain')`,[id]));
  const stored=await db.query<any>('select status,file_size_bytes,file_type from journey_videos where id=$1',[id]);
  expect(stored.rows[0]).toMatchObject({status:'ready',file_size_bytes:20000000,file_type:'video/mp4'});
  const readable:any=await actor('authenticated',C,tx=>tx.query('select name from storage.objects where name=$1',[C+'/quota-0.mp4']));
  expect(readable.rows).toHaveLength(1);
  await actor('authenticated',C,tx=>tx.query('select mark_journey_video_for_deletion($1)',[id]));
  const hidden:any=await actor('authenticated',C,tx=>tx.query('select name from storage.objects where name=$1',[C+'/quota-0.mp4']));
  expect(hidden.rows).toHaveLength(0);
  await expect(actor('authenticated',C,tx=>tx.query('select confirm_journey_video_deleted($1,true,null)',[id]))).rejects.toThrow(/still exists/);
  await expect(reserve('quota-still-full')).rejects.toThrow(/quota exceeded/);
  await db.query("delete from storage.objects where bucket_id='comparison_videos' and name=$1",[C+'/quota-0.mp4']);
  await actor('authenticated',C,tx=>tx.query('select confirm_journey_video_deleted($1,true,null)',[id]));
  await expect(reserve('quota-grant-still-valid')).rejects.toThrow(/quota exceeded/);
  // A still-valid signed token could recreate the object after deletion. It must still count after expiry.
  await db.query(`insert into storage.objects(bucket_id,name,metadata) values('comparison_videos',$1,'{"size":20000000,"mimetype":"video/mp4"}')`,[C+'/quota-0.mp4']);
  await db.query("update journey_videos set expires_at=now()-interval '1 minute' where user_id=$1",[C]);
  await reserve('quota-after-expiry');
  for(let i=0;i<3;i++) await reserve('post-expiry-'+i);
  await expect(reserve('orphan-must-count')).rejects.toThrow(/quota exceeded/);
  await actor('authenticated',C,tx=>tx.query('select cleanup_expired_journey_video_reservations()'));
  const orphan=await db.query<any>('select status from journey_videos where id=$1',[id]);
  expect(orphan.rows[0].status).toBe('pending_deletion');
 });
 it('replays the original reservation without creating a second path or releasing held capacity',async()=>{
  const first=await reserve('quota-after-expiry');
  const again=await reserve('quota-after-expiry');
  expect(again).toBe(first);
  const rows=await db.query<any>('select count(*)::int n from journey_videos where user_id=$1 and idempotency_key=$2',[C,'quota-after-expiry']);
  expect(rows.rows[0].n).toBe(1);
 });
});

describe('Compatible evidence and post-workout IDs',()=>{
 let runId:string,activityId:string,resultId:string;
 it('resolves actual activity/result IDs, rejects generic activity, wrong variant/assistance and another owner',async()=>{
  const setup:any=await actor('authenticated',B,async tx=>{
   const program=await tx.query(`insert into programs(user_id,title,description,is_demo) values($1,'Test','Fixture',true) returning id`,[B]);
   const session=await tx.query(`insert into sessions(program_id,user_id,title,sequence_order,exercises,is_demo) values($1,$2,'Test',1,'[]',true) returning id`,[program.rows[0].id,B]);
   const run=await tx.query(`insert into workout_runs(user_id,session_id,session_title,status,completed_at,idempotency_key) values($1,$2,'Verified test workout','completed',now(),'proof-key') returning id`,[B,session.rows[0].id]);
   const act=await tx.query(`insert into activities(user_id,activity_type,is_planned,start_at,duration_minutes,source,idempotency_key) values($1,'calisthenics',false,now(),15,'manual_entry','proof-key') returning id`,[B]);
   const sr=await tx.query(`insert into session_results(user_id,session_id,completed_at,self_reported_data,idempotency_key) values($1,$2,now(),'{}','proof-key') returning id`,[B,session.rows[0].id]);
   await tx.query(`insert into workout_sets(run_id,user_id,exercise_index,exercise_name,exercise_variant,set_order,target_reps,actual_duration_seconds,actual_unit,actual_assistance,status,idempotency_key) values($1,$2,0,'dead_hang','active_grip',1,'30s',20,'seconds','bodyweight','completed','proof-set')`,[run.rows[0].id,B]);
   return {runId:run.rows[0].id,activityId:act.rows[0].id,resultId:sr.rows[0].id};
  });
  ({runId,activityId,resultId}=setup);
  const sources:any=await actor('authenticated',B,tx=>tx.query(`select * from get_compatible_journey_evidence('dead_hang','active_grip','bodyweight',$1)`,[runId]));
  expect(sources.rows).toHaveLength(1);
  expect(sources.rows[0]).toMatchObject({source_id:resultId,run_id:runId,source_type:'session_result'});
  expect(resultId).not.toBe(runId);
  for(const [exercise,variant,assist,owner] of [['standard_pull_up','deadstop','bodyweight',B],['dead_hang','standard','bodyweight',B],['dead_hang','active_grip','band',B],['dead_hang','active_grip','bodyweight',A]]) {
   const r:any=await actor('authenticated',owner,tx=>tx.query('select * from get_compatible_journey_evidence($1,$2,$3,$4)',[exercise,variant,assist,runId]));
   expect(r.rows).toHaveLength(0);
  }
 });
 it('enforces the same source compatibility on insert, and invalidates proof after set edits',async()=>{
  const insert=(sourceId:string,sourceType:string)=>actor('authenticated',B,tx=>tx.query(`insert into journey_attempts(user_id,journey_id,milestone_id,exercise_id,variant_id,assistance,actual_duration_seconds,is_achieved_self_reported,status,source_ref) values($1,'pull_up_mastery','dead_hang_30s','dead_hang','active_grip','bodyweight',20,false,'attempted',$2) returning id`,[B,JSON.stringify({sourceType,sourceId,recordedAt:new Date().toISOString()})]));
  await expect(insert(runId,'session_result')).rejects.toThrow(/Source must/);
  await expect(insert(activityId,'activity')).rejects.toThrow(/Source must/); // Prefer the existing session_result for this run.
  const valid:any=await insert(resultId,'session_result');
  await actor('authenticated',B,tx=>tx.query('update workout_sets set actual_duration_seconds=10 where run_id=$1',[runId]));
  const attempt=await db.query<any>('select status from journey_attempts where id=$1',[valid.rows[0].id]);
  expect(attempt.rows[0].status).toBe('needs_review');
  const actual=await db.query<any>('select actual_duration_seconds from workout_sets where run_id=$1',[runId]);
  expect(actual.rows[0].actual_duration_seconds).toBe(10);
 });
});

describe('Preview confirmation',()=>{
 it('rejects modified fields, changed source versions, changed options, wrong owner and unsigned snapshots',()=>{
  const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-only-key';
  try {
   const input:any={briefType:'workout',title:'Test',dateRangeStart:'2026-10-01',dateRangeEnd:'2026-10-28',includedCategories:[],enableAISummary:false};
   const preview:any={meta:{title:'Test',generatedAt:'2026-10-01'},overview:{totalRecords:1},sourceRefs:[{sourceId:'one',sourceUpdatedAt:'v1'}]};
   preview.confirmationToken=signBriefPreview(A,input,preview);
   expect(verifyBriefPreview(A,input,preview,{...preview,meta:{...preview.meta,generatedAt:'2026-10-28'}})).toBe(true);
   expect(verifyBriefPreview(A,input,{...preview,overview:{totalRecords:999}},preview)).toBe(false);
   expect(verifyBriefPreview(A,input,preview,{...preview,sourceRefs:[{sourceId:'one',sourceUpdatedAt:'v2'}]})).toBe(false);
   expect(verifyBriefPreview(A,{...input,title:'Changed'},preview,preview)).toBe(false);
   expect(verifyBriefPreview(B,input,preview,preview)).toBe(false);
   expect(verifyBriefPreview(A,input,{...preview,confirmationToken:undefined},preview)).toBe(false);
  } finally {if(previous===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;}
 });
});

describe('Timed workout completion',()=>{
 it('does not confuse a duration with reps or skipped sets with missing input',()=>{
  const hold:any={status:'completed',actual_unit:'seconds',actual_duration_seconds:20,actual_reps:null};
  expect(hasWorkoutSetActual(hold)).toBe(true);
  expect(isWorkoutSetIncomplete(hold)).toBe(false);
  expect(isWorkoutSetIncomplete({...hold,actual_duration_seconds:null,actual_reps:20})).toBe(true);
  expect(isWorkoutSetIncomplete({...hold,status:'skipped',actual_duration_seconds:null})).toBe(false);
 });
 it('finalizes a real timed-only run and resolves its activity evidence without needing a session result',async()=>{
  const run:any=await actor('authenticated',B,async tx=>{
   const r=await tx.query(`insert into workout_runs(user_id,session_title,status,idempotency_key) values($1,'Timed run','in_progress','timed-initial') returning id`,[B]);
   await tx.query(`insert into workout_sets(run_id,user_id,exercise_index,exercise_name,exercise_variant,set_order,target_reps,actual_duration_seconds,actual_unit,actual_assistance,status,idempotency_key) values($1,$2,0,'dead_hang','active_grip',1,'30s',25,'seconds','bodyweight','completed','timed-set')`,[r.rows[0].id,B]);
   return r.rows[0];
  });
  const result:any=await actor('authenticated',B,tx=>tx.query(`select finalize_workout_run($1,null,5,null,'timed-final',false) data`,[run.id]));
  expect(result.rows[0].data.is_partial).toBe(false);
  expect(result.rows[0].data.session_result_id).toBeNull();
  const sources:any=await actor('authenticated',B,tx=>tx.query(`select * from get_compatible_journey_evidence('dead_hang','active_grip','bodyweight',$1)`,[run.id]));
  expect(sources.rows[0]).toMatchObject({source_id:result.rows[0].data.activity_id,source_type:'activity',run_id:run.id});
  const set=await db.query<any>('select status,actual_duration_seconds,actual_reps from workout_sets where run_id=$1',[run.id]);
  expect(set.rows[0]).toMatchObject({status:'completed',actual_duration_seconds:25,actual_reps:null});
 });
});
