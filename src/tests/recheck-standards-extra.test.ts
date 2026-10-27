// Review-only regression probes. All transport mocked, synthetic bytes, no cloud.
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  docs: [] as any[], files: new Map<string, number>(), failInsert: false, failRemove: false,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/auth-guard', () => ({ requireAuthenticatedUser: async () => ({ user: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' } }) }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({
  storage: { from: () => ({
    upload: async (path: string, content: ArrayBuffer) => { state.files.set(path, content.byteLength); return {error:null}; },
    remove: async (paths: string[]) => {
      if (state.failRemove) return {error:{message:'Synthetic remove failure'}};
      paths.forEach(p=>state.files.delete(p)); return {error:null};
    },
  }) },
  from(table: string) {
    let row: any;
    const builder: any = {
      select: () => builder, eq: () => builder,
      insert: (input: any) => { row={id:crypto.randomUUID(),...input}; if(!state.failInsert)state.docs.push(row); return builder; },
      single: async () => state.failInsert ? {data:null,error:{message:'Synthetic insert failure'}} : {data:row,error:null},
      maybeSingle: async () => ({data:null,error:null}),
      then: (resolve:any,reject:any) => Promise.resolve({data:table==='health_documents'?[...state.docs]:[],error:null}).then(resolve,reject),
    }; return builder;
  },
}) }));
import { uploadHealthDocumentAction, createHealthDocumentAction } from '@/lib/server/health-profile-actions';
import { USER_STORAGE_QUOTA_BYTES } from '@/contracts';
const MB=1024*1024;
function pdf(size=100) {
  const bytes=new Uint8Array(size); bytes.set([0x25,0x50,0x44,0x46,0x2d]);
  const fd=new FormData();fd.append('file',new File([bytes],'synthetic.pdf',{type:'application/pdf'}));
  fd.append('title','Synthetic document');return fd;
}
describe('7debc35 Standards regression probes',()=>{
  beforeEach(()=>{state.docs=[];state.files.clear();state.failInsert=false;state.failRemove=false});
  it('must reserve quota across two uploads running concurrently',async()=>{
    state.docs=[{file_size_bytes:90*MB}];
    const result=await Promise.all([uploadHealthDocumentAction(pdf(9*MB)),uploadHealthDocumentAction(pdf(9*MB))]);
    const usage=state.docs.reduce((sum,d)=>sum+d.file_size_bytes,0);
    expect({successful:result.filter(r=>r.success).length,withinQuota:usage<=USER_STORAGE_QUOTA_BYTES}).toEqual({successful:1,withinQuota:true});
  });
  it('must not lose the only file reference when insert and cleanup both fail',async()=>{
    state.failInsert=true;state.failRemove=true;
    const result=await uploadHealthDocumentAction(pdf());
    expect(result.success).toBe(false);
    expect({orphanFiles:state.files.size,persistedDocuments:state.docs.length}).not.toEqual({orphanFiles:1,persistedDocuments:0});
  });
  it('must reject metadata for a storage object that was never uploaded',async()=>{
    const result=await createHealthDocumentAction({title:'Synthetic',file_name:'synthetic.pdf',file_type:'application/pdf',file_size_bytes:100,
      storage_path:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/never-uploaded.pdf'});
    expect(result.success).toBe(false);
  });
});
