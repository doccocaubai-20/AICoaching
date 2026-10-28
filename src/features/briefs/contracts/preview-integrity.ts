import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BriefSnapshotPayload, CreateBriefSnapshotInput } from './briefs.contract';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
function material(userId:string,input:CreateBriefSnapshotInput,snapshot:BriefSnapshotPayload) {
  const { confirmationToken: _token, ...rest }=snapshot;
  const { generatedAt:_time,...meta }=rest.meta;
  return canonical({purpose:'brief-preview-v1',userId,input,snapshot:{...rest,meta}});
}
export function signBriefPreview(userId:string,input:CreateBriefSnapshotInput,snapshot:BriefSnapshotPayload):string {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Chưa cấu hình xác nhận bản tóm tắt phía server.');
  return createHmac('sha256',key).update(material(userId,input,snapshot)).digest('hex');
}
export function verifyBriefPreview(userId:string,input:CreateBriefSnapshotInput,preview:BriefSnapshotPayload,current:BriefSnapshotPayload):boolean {
  const token=preview.confirmationToken;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected=signBriefPreview(userId,input,preview);
  return timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(expected,'hex')) && material(userId,input,preview)===material(userId,input,current);
}
