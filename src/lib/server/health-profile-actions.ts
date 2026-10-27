'use server';

/**
 * CALISCOACHING - SERVER ACTIONS CHO HỒ SƠ SỨC KHỎE CÁ NHÂN V2
 * Xử lý dữ liệu hồ sơ nền, chỉ số huyết áp, sinh hoạt, tình trạng y tế, thuốc, dị ứng, sự kiện và tài liệu.
 */

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  HealthProfileEntity,
  UpdateHealthProfileInput,
  validateHealthProfileInput,
  BloodPressureEntity,
  CreateBloodPressureInput,
  validateBloodPressureInput,
  DailyCheckinEntity,
  UpsertDailyCheckinInput,
  validateDailyCheckinInput,
  HealthConditionEntity,
  CreateHealthConditionInput,
  validateHealthConditionInput,
  AllergyEntity,
  CreateAllergyInput,
  validateAllergyInput,
  MedicationEntity,
  CreateMedicationInput,
  validateMedicationInput,
  HealthEventEntity,
  CreateHealthEventInput,
  validateHealthEventInput,
  HealthDocumentEntity,
  CreateHealthDocumentInput,
  validateHealthDocumentInput,
  ConditionStatus,
  MedicationStatus,
  validateObservationInput,
  MetricType,
  ObservationSource,
  MAX_DOCUMENT_SIZE_BYTES,
  USER_STORAGE_QUOTA_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  HealthDocumentFileType,
} from '@/contracts';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

// ==============================================================================
// 1. HỒ SƠ NỀN (HEALTH PROFILE BACKGROUND)
// ==============================================================================
export async function updateHealthProfileBackgroundAction(
  input: UpdateHealthProfileInput
): Promise<ActionResult<HealthProfileEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    const validation = validateHealthProfileInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Thông tin không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('health_profiles')
      .upsert(
        {
          user_id: user.id,
          birth_year: input.birth_year ?? null,
          work_context: input.work_context ?? null,
          timezone: input.timezone || 'Asia/Ho_Chi_Minh',
          notes: input.notes?.trim() || null,
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi cập nhật hồ sơ nền: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã cập nhật thông tin nền thành công.', data: data as HealthProfileEntity };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

// ==============================================================================
// 2. HUYẾT ÁP (BLOOD PRESSURE READINGS)
// ==============================================================================
export async function addBloodPressureAction(
  input: CreateBloodPressureInput
): Promise<ActionResult<BloodPressureEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    const validation = validateBloodPressureInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Chỉ số huyết áp không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('blood_pressure_readings')
      .insert({
        user_id: user.id,
        systolic: input.systolic,
        diastolic: input.diastolic,
        measured_at: input.measured_at || new Date().toISOString(),
        source: input.source || 'self_reported',
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi lưu huyết áp: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã lưu chỉ số huyết áp.', data: data as BloodPressureEntity };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function deleteBloodPressureAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('blood_pressure_readings')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi xóa bản ghi: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã xóa bản ghi huyết áp.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

// ==============================================================================
// 3. SINH HOẠT HẰNG NGÀY (DAILY CHECK-IN)
// ==============================================================================
export async function upsertDailyCheckinAction(
  input: UpsertDailyCheckinInput
): Promise<ActionResult<DailyCheckinEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateDailyCheckinInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Dữ liệu sinh hoạt không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('daily_checkins')
      .upsert(
        {
          user_id: user.id,
          local_date: input.local_date,
          sleep_start: input.sleep_start || null,
          sleep_end: input.sleep_end || null,
          sleep_duration_minutes: input.sleep_duration_minutes ?? null,
          sleep_quality: input.sleep_quality ?? null,
          energy_level: input.energy_level ?? null,
          stress_level: input.stress_level ?? null,
          notes: input.notes?.trim() || null,
        },
        { onConflict: 'user_id,local_date' }
      )
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi lưu nhật ký sinh hoạt: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã lưu ghi nhận sinh hoạt thành công.', data: data as DailyCheckinEntity };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function deleteDailyCheckinAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('daily_checkins')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi xóa nhật ký: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã xóa bản ghi sinh hoạt.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

// ==============================================================================
// 4. TÌNH TRẠNG SỨC KHỎE (HEALTH CONDITIONS)
// ==============================================================================
export async function addHealthConditionAction(
  input: CreateHealthConditionInput
): Promise<ActionResult<HealthConditionEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateHealthConditionInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Thông tin tình trạng không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('health_conditions')
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        category: input.category,
        started_at: input.started_at || null,
        status: input.status || 'active',
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi lưu tình trạng: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã thêm tình trạng sức khỏe.', data: data as HealthConditionEntity };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function updateHealthConditionStatusAction(
  id: string,
  status: ConditionStatus
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('health_conditions')
      .update({ status })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi cập nhật: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã cập nhật trạng thái theo dõi.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function deleteHealthConditionAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('health_conditions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi xóa tình trạng: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã xóa tình trạng sức khỏe.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

// ==============================================================================
// 5. DỊ ỨNG (ALLERGIES)
// ==============================================================================
export async function addAllergyAction(input: CreateAllergyInput): Promise<ActionResult<AllergyEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateAllergyInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Thông tin dị ứng không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('allergies')
      .insert({
        user_id: user.id,
        allergen: input.allergen.trim(),
        reaction: input.reaction?.trim() || null,
        severity: input.severity || null,
        status: input.status || 'known',
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi lưu dị ứng: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã thêm thông tin dị ứng.', data: data as AllergyEntity };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function deleteAllergyAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('allergies')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi xóa dị ứng: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã xóa thông tin dị ứng.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

// ==============================================================================
// 6. THUỐC (MEDICATIONS)
// ==============================================================================
export async function addMedicationAction(input: CreateMedicationInput): Promise<ActionResult<MedicationEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateMedicationInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Thông tin thuốc không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('medications')
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        dosage_instructions: input.dosage_instructions?.trim() || null,
        started_at: input.started_at || null,
        ended_at: input.ended_at || null,
        status: input.status || 'active',
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi lưu thuốc: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã thêm thông tin thuốc.', data: data as MedicationEntity };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function updateMedicationStatusAction(id: string, status: MedicationStatus): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('medications')
      .update({ status })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi cập nhật: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã cập nhật trạng thái dùng thuốc.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function deleteMedicationAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi xóa thuốc: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã xóa thông tin thuốc.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

// ==============================================================================
// 7. SỰ KIỆN KHÁM BỆNH & TÀI LIỆU (EVENTS & DOCUMENTS)
// ==============================================================================
export async function addHealthEventAction(input: CreateHealthEventInput): Promise<ActionResult<HealthEventEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateHealthEventInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Sự kiện y tế không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('health_events')
      .insert({
        user_id: user.id,
        event_type: input.event_type,
        event_date: input.event_date,
        facility_name: input.facility_name?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi lưu sự kiện: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã thêm sự kiện khám/xét nghiệm.', data: data as HealthEventEntity };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function deleteHealthEventAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('health_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi xóa sự kiện: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã xóa sự kiện.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function createHealthDocumentAction(
  _input: CreateHealthDocumentInput
): Promise<ActionResult<HealthDocumentEntity>> {
  // [S3] Từ chối việc chèn metadata thủ công tùy ý từ client mà không qua luồng upload kiểm soát
  // Toàn bộ tài liệu y tế bắt buộc phải tải lên qua uploadHealthDocumentAction để đảm bảo file tồn tại và đúng chủ sở hữu
  return {
    success: false,
    message: 'Không cho phép tạo bản ghi tài liệu tùy ý. Vui lòng tải tài liệu lên qua luồng upload kiểm soát.',
  };
}

const userUploadQueues = new Map<string, Promise<unknown>>();

async function runWithUserUploadLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = userUploadQueues.get(userId) || Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  userUploadQueues.set(userId, next);

  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (userUploadQueues.get(userId) === next) {
      userUploadQueues.delete(userId);
    }
  }
}

export async function uploadHealthDocumentAction(formData: FormData): Promise<ActionResult<HealthDocumentEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const file = formData.get('file') as File | null;
    if (!file || typeof file === 'string' || file.size === 0) {
      return { success: false, message: 'Vui lòng chọn tệp tài liệu hợp lệ.' };
    }

    // 1. Kiểm tra kích thước tệp (tối đa 10MB)
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return { success: false, message: 'Kích thước tệp vượt quá giới hạn 10MB.' };
    }

    // 2. Kiểm tra định dạng MIME
    const mimeType = file.type as HealthDocumentFileType;
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType)) {
      return { success: false, message: 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, JPEG, PNG.' };
    }

    // 3. [S1] Sử dụng khóa tuần tự hóa theo người dùng để ngăn chặn hoàn toàn race condition quota đồng thời
    return await runWithUserUploadLock(user.id, async () => {
      const { data: existingDocs, error: quotaErr } = await supabase
        .from('health_documents')
        .select('file_size_bytes')
        .eq('user_id', user.id);

      if (quotaErr) {
        return { success: false, message: 'Không thể kiểm tra dung lượng tài khoản: ' + quotaErr.message };
      }

      const currentUsage = (existingDocs || []).reduce((acc, d) => acc + (d.file_size_bytes || 0), 0);
      if (currentUsage + file.size > USER_STORAGE_QUOTA_BYTES) {
        return { success: false, message: 'Vượt quá hạn mức lưu trữ tài liệu y tế (100MB/người dùng).' };
      }

      // 4. Kiểm tra magic bytes
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let isValidContent = false;
      if (mimeType === 'application/pdf') {
        isValidContent = bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D;
      } else if (mimeType === 'image/png') {
        isValidContent = bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      } else if (mimeType === 'image/jpeg') {
        isValidContent = bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      }

      if (!isValidContent) {
        return { success: false, message: 'Nội dung tệp không khớp với định dạng tệp đã chọn.' };
      }

      // 5. Kiểm tra event_id nếu có
      const rawEventId = formData.get('event_id') as string | null;
      const eventId = rawEventId && rawEventId.trim().length > 0 ? rawEventId.trim() : null;
      if (eventId) {
        const { data: event, error: eventErr } = await supabase
          .from('health_events')
          .select('id')
          .eq('id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (eventErr || !event) {
          return { success: false, message: 'Sự kiện y tế không tồn tại hoặc không thuộc quyền sở hữu của bạn.' };
        }
      }

      // 6. Tạo đường dẫn an toàn do Server kiểm soát
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const randomUuid = crypto.randomUUID();
      const storagePath = `${user.id}/${randomUuid}-${sanitizedName}`;
      const rawTitle = (formData.get('title') as string) || file.name;
      const rawNotes = formData.get('notes') as string | null;

      // 7. [S2] Lưu metadata vào DB trước để giữ chỗ bền vững
      // Nếu bước này lỗi, file CHƯA upload lên storage nên không bao giờ tạo tệp mồ côi
      const { data: newDoc, error: insertError } = await supabase
        .from('health_documents')
        .insert({
          user_id: user.id,
          event_id: eventId,
          title: rawTitle.trim(),
          file_name: file.name,
          file_type: mimeType,
          file_size_bytes: file.size,
          storage_path: storagePath,
          notes: rawNotes?.trim() || null,
        })
        .select('*')
        .single();

      if (insertError) {
        return { success: false, message: 'Lỗi lưu thông tin tài liệu: ' + insertError.message };
      }

      // 8. Upload file lên private bucket sau khi metadata đã được giữ chỗ
      const { error: uploadError } = await supabase.storage
        .from('health_documents')
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        // Dọn dẹp metadata nếu upload storage thất bại
        await supabase.from('health_documents').delete().eq('storage_path', storagePath);
        return { success: false, message: 'Lỗi tải tệp lên kho lưu trữ: ' + uploadError.message };
      }

      revalidatePath('/profile');
      revalidatePath('/health');
      return { success: true, message: 'Tải tài liệu lên thành công.', data: newDoc as HealthDocumentEntity };
    });
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function getHealthDocumentSignedUrlAction(id: string): Promise<ActionResult<{ signedUrl: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { data: doc, error: docError } = await supabase
      .from('health_documents')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (docError || !doc) {
      return { success: false, message: 'Không tìm thấy tài liệu hoặc không có quyền truy cập.' };
    }

    const { data, error: signError } = await supabase.storage
      .from('health_documents')
      .createSignedUrl(doc.storage_path, 300); // 5 phút

    if (signError || !data?.signedUrl) {
      return { success: false, message: 'Không thể tạo liên kết truy cập tài liệu: ' + (signError?.message || '') };
    }

    return { success: true, data: { signedUrl: data.signedUrl } };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function renameHealthDocumentAction(id: string, newTitle: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    if (!newTitle || newTitle.trim().length === 0) {
      return { success: false, message: 'Tiêu đề tài liệu không được để trống.' };
    }

    const { error } = await supabase
      .from('health_documents')
      .update({ title: newTitle.trim() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: 'Lỗi đổi tên tài liệu: ' + error.message };
    }

    revalidatePath('/profile');
    revalidatePath('/health');
    return { success: true, message: 'Đổi tên tài liệu thành công.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function deleteHealthDocumentAction(id: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    // 1. Lấy thông tin tài liệu để lấy storage_path
    const { data: doc, error: docError } = await supabase
      .from('health_documents')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (docError) {
      return { success: false, message: 'Lỗi truy vấn tài liệu: ' + docError.message };
    }
    if (!doc) {
      return { success: false, message: 'Tài liệu không tồn tại hoặc đã bị xóa.' };
    }

    if (doc.storage_path) {
      // 2. Thử xóa tệp từ storage
      const { error: storageError } = await supabase.storage.from('health_documents').remove([doc.storage_path]);
      if (storageError) {
        // [S3] XÓA FILE LỖI: KHÔNG ĐƯỢC XÓA METADATA VÀ KHÔNG BÁO THÀNH CÔNG!
        return {
          success: false,
          message: 'Không thể xóa tệp trên hệ thống lưu trữ: ' + storageError.message,
        };
      }
    }

    // 3. Xóa bản ghi trong database chỉ khi file storage đã được xóa thành công
    const { error } = await supabase
      .from('health_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi xóa tài liệu: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã xóa tài liệu.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}


// ==============================================================================
// 8. CHỈ SỐ THỂ CHẤT TRỰC TIẾP (OBSERVATIONS ACTIONS)
// ==============================================================================
export async function addObservationDirectAction(input: {
  metric_type: MetricType;
  metric_value: number;
  metric_unit: string;
  observed_at?: string;
  source?: ObservationSource;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    // [S4] Bắt buộc validation qua hợp đồng
    const validation = validateObservationInput(input);
    if (!validation.is_valid) {
      return {
        success: false,
        message: Object.values(validation.errors).join(' '),
        errors: validation.errors,
      };
    }

    const { error } = await supabase.from('observations').insert({
      user_id: user.id,
      metric_type: input.metric_type,
      metric_value: input.metric_value,
      metric_unit: input.metric_unit.trim(),
      observed_at: input.observed_at || new Date().toISOString(),
      notes: input.notes?.trim() || null,
      source: input.source || 'self_reported',
    });

    if (error) {
      return { success: false, message: `Lỗi lưu chỉ số: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/health');
    revalidatePath('/dashboard');
    return { success: true, message: 'Đã lưu chỉ số thành công.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function updateObservationAction(
  id: string,
  input: {
    metric_value: number;
    metric_unit: string;
    observed_at?: string;
    source?: ObservationSource;
    notes?: string | null;
  }
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    if (typeof input.metric_value !== 'number' || isNaN(input.metric_value) || input.metric_value <= 0) {
      return { success: false, message: 'Giá trị chỉ số phải là số dương lớn hơn 0.' };
    }
    if (!input.metric_unit || input.metric_unit.trim().length === 0) {
      return { success: false, message: 'Đơn vị chỉ số không được để trống.' };
    }

    const updatePayload: {
      metric_value: number;
      metric_unit: string;
      notes: string | null;
      observed_at?: string;
      source?: ObservationSource;
    } = {
      metric_value: input.metric_value,
      metric_unit: input.metric_unit.trim(),
      notes: input.notes?.trim() || null,
    };
    if (input.observed_at) updatePayload.observed_at = input.observed_at;
    if (input.source) updatePayload.source = input.source;

    const { error } = await supabase
      .from('observations')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi cập nhật chỉ số: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/health');
    revalidatePath('/dashboard');
    return { success: true, message: 'Đã cập nhật chỉ số thành công.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function updateBloodPressureAction(
  id: string,
  input: {
    systolic: number;
    diastolic: number;
    measured_at?: string;
    source?: ObservationSource;
    notes?: string | null;
  }
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateBloodPressureInput(input);
    if (!validation.is_valid) {
      return { success: false, message: Object.values(validation.errors).join(' '), errors: validation.errors };
    }

    const updatePayload: {
      systolic: number;
      diastolic: number;
      notes: string | null;
      measured_at?: string;
      source?: ObservationSource;
    } = {
      systolic: input.systolic,
      diastolic: input.diastolic,
      notes: input.notes?.trim() || null,
    };
    if (input.measured_at) updatePayload.measured_at = input.measured_at;
    if (input.source) updatePayload.source = input.source;

    const { error } = await supabase
      .from('blood_pressure_readings')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi cập nhật huyết áp: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/health');
    revalidatePath('/dashboard');
    return { success: true, message: 'Đã cập nhật huyết áp thành công.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

