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
  input: CreateHealthDocumentInput
): Promise<ActionResult<HealthDocumentEntity>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateHealthDocumentInput(input);
    if (!validation.is_valid) {
      return { success: false, message: 'Thông tin tài liệu không hợp lệ.', errors: validation.errors };
    }

    const { data, error } = await supabase
      .from('health_documents')
      .insert({
        user_id: user.id,
        event_id: input.event_id || null,
        title: input.title.trim(),
        file_name: input.file_name.trim(),
        file_type: input.file_type,
        file_size_bytes: input.file_size_bytes,
        storage_path: input.storage_path.trim(),
        notes: input.notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, message: `Lỗi lưu metadata tài liệu: ${error.message}` };
    }

    revalidatePath('/profile'); revalidatePath('/health'); revalidatePath('/dashboard');
    return { success: true, message: 'Đã lưu tài liệu thành công.', data: data as HealthDocumentEntity };
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
    const { data: doc } = await supabase
      .from('health_documents')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (doc?.storage_path) {
      // 2. Thử xóa tệp từ storage
      await supabase.storage.from('health_documents').remove([doc.storage_path]);
    }

    // 3. Xóa bản ghi trong database
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
// 8. CHỈ SỐ THỂ CHẤT TRỰC TIẾP (OBSERVATION DIRECT ACTION)
// ==============================================================================
export async function addObservationDirectAction(input: {
  metric_type: any;
  metric_value: number;
  metric_unit: string;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase.from('observations').insert({
      user_id: user.id,
      metric_type: input.metric_type,
      metric_value: input.metric_value,
      metric_unit: input.metric_unit,
      notes: input.notes?.trim() || null,
      source: 'self_reported',
    });

    if (error) {
      return { success: false, message: `Lỗi lưu chỉ số: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');
    return { success: true, message: 'Đã lưu chỉ số thành công.' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}
