'use client';

import React, { useState } from 'react';
import { Stethoscope, Pill, AlertTriangle, PlusCircle, Trash2, CheckCircle2, Clock } from 'lucide-react';
import {
  HealthConditionEntity,
  AllergyEntity,
  MedicationEntity,
  ConditionCategory,
  ConditionStatus,
  AllergySeverity,
  AllergyStatus,
  MedicationStatus,
} from '@/contracts';
import {
  addHealthConditionAction,
  updateHealthConditionStatusAction,
  deleteHealthConditionAction,
  addAllergyAction,
  deleteAllergyAction,
  addMedicationAction,
  updateMedicationStatusAction,
  deleteMedicationAction,
} from '@/lib/server/health-profile-actions';

interface MedicalTabProps {
  conditions: HealthConditionEntity[];
  allergies: AllergyEntity[];
  medications: MedicationEntity[];
}

export function MedicalTab({ conditions, allergies, medications }: MedicalTabProps) {
  // Modal / Form state cho Tình trạng
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [condName, setCondName] = useState('');
  const [condCategory, setCondCategory] = useState<ConditionCategory>('diagnosed_condition');
  const [condStatus, setCondStatus] = useState<ConditionStatus>('active');
  const [condStartedAt, setCondStartedAt] = useState('');
  const [condNotes, setCondNotes] = useState('');
  const [isSubmittingCond, setIsSubmittingCond] = useState(false);

  // Modal / Form state cho Dị ứng
  const [showAllergyForm, setShowAllergyForm] = useState(false);
  const [allergen, setAllergen] = useState('');
  const [allergyReaction, setAllergyReaction] = useState('');
  const [allergySeverity, setAllergySeverity] = useState<AllergySeverity>('moderate');
  const [allergyStatus, setAllergyStatus] = useState<AllergyStatus>('known');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [isSubmittingAllergy, setIsSubmittingAllergy] = useState(false);

  // Modal / Form state cho Thuốc
  const [showMedForm, setShowMedForm] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medStartedAt, setMedStartedAt] = useState('');
  const [medStatus, setMedStatus] = useState<MedicationStatus>('active');
  const [medNotes, setMedNotes] = useState('');
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);

  // Xử lý Thêm tình trạng
  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condName.trim()) return;
    setIsSubmittingCond(true);

    await addHealthConditionAction({
      name: condName.trim(),
      category: condCategory,
      status: condStatus,
      started_at: condStartedAt || null,
      notes: condNotes.trim() || null,
    });

    setIsSubmittingCond(false);
    setCondName('');
    setCondNotes('');
    setShowConditionForm(false);
  };

  // Xử lý Thêm dị ứng
  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allergen.trim()) return;
    setIsSubmittingAllergy(true);

    await addAllergyAction({
      allergen: allergen.trim(),
      reaction: allergyReaction.trim() || null,
      severity: allergySeverity,
      status: allergyStatus,
      notes: allergyNotes.trim() || null,
    });

    setIsSubmittingAllergy(false);
    setAllergen('');
    setAllergyReaction('');
    setAllergyNotes('');
    setShowAllergyForm(false);
  };

  // Xử lý Thêm thuốc
  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;
    setIsSubmittingMed(true);

    await addMedicationAction({
      name: medName.trim(),
      dosage_instructions: medDosage.trim() || null,
      started_at: medStartedAt || null,
      status: medStatus,
      notes: medNotes.trim() || null,
    });

    setIsSubmittingMed(false);
    setMedName('');
    setMedDosage('');
    setMedNotes('');
    setShowMedForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Cảnh báo y tế minh bạch */}
      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <strong>Lưu ý bảo mật & y khoa:</strong> Toàn bộ thông tin dưới đây do bạn tự khai nhằm mục đích lưu trữ và theo dõi cá nhân. Ứng dụng không chẩn đoán bệnh tật, không kê đơn và không tự ý đưa ra kết luận điều trị thay cho bác sĩ.
        </div>
      </div>

      {/* 1. TÌNH TRẠNG SỨC KHỎE & CHẤN THƯƠNG */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Tình trạng sức khỏe & Chấn thương ({conditions.length})
            </h2>
          </div>
          <button
            onClick={() => setShowConditionForm(true)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-1 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Thêm tình trạng
          </button>
        </div>

        {/* Form thêm tình trạng */}
        {showConditionForm && (
          <form onSubmit={handleAddCondition} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Ghi nhận tình trạng mới</h4>
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Tên tình trạng / Triệu chứng</label>
              <input
                type="text"
                placeholder="Ví dụ: Đau cổ tay khi hít xà, Thoát vị đĩa đệm L4-L5, ..."
                value={condName}
                onChange={(e) => setCondName(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Phân loại</label>
                <select
                  value={condCategory}
                  onChange={(e) => setCondCategory(e.target.value as ConditionCategory)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                >
                  <option value="diagnosed_condition">Bệnh khai (được chẩn đoán)</option>
                  <option value="injury">Chấn thương thể thao / sinh hoạt</option>
                  <option value="self_reported_symptom">Triệu chứng tự ghi nhận</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Trạng thái theo dõi</label>
                <select
                  value={condStatus}
                  onChange={(e) => setCondStatus(e.target.value as ConditionStatus)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                >
                  <option value="active">Đang theo dõi / chưa khỏi</option>
                  <option value="monitoring">Theo dõi định kỳ</option>
                  <option value="resolved">Đã ổn định / đã khỏi</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConditionForm(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingCond}
                className="px-3 py-1 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {isSubmittingCond ? 'Đang lưu...' : 'Lưu tình trạng'}
              </button>
            </div>
          </form>
        )}

        {/* Danh sách tình trạng */}
        {conditions.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {conditions.map((c) => (
              <div key={c.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      c.status === 'active' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                      c.status === 'monitoring' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {c.status === 'active' ? 'Đang theo dõi' : c.status === 'monitoring' ? 'Theo dõi định kỳ' : 'Đã ổn định'}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Phân loại: {c.category === 'diagnosed_condition' ? 'Bệnh khai (bác sĩ chẩn đoán)' : c.category === 'injury' ? 'Chấn thương' : 'Triệu chứng tự ghi'}
                    {c.notes ? ` • Ghi chú: ${c.notes}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => updateHealthConditionStatusAction(c.id, c.status === 'active' ? 'resolved' : 'active')}
                    className="text-[11px] text-teal-600 hover:underline font-medium"
                  >
                    {c.status === 'active' ? 'Đánh dấu đã khỏi' : 'Mở lại theo dõi'}
                  </button>
                  <button
                    onClick={() => deleteHealthConditionAction(c.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa ghi nhận tình trạng nào.</p>
        )}
      </div>

      {/* 2. DỊ ỨNG */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Dị ứng ({allergies.length})
            </h2>
          </div>
          <button
            onClick={() => setShowAllergyForm(true)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Thêm dị ứng
          </button>
        </div>

        {/* Form thêm dị ứng */}
        {showAllergyForm && (
          <form onSubmit={handleAddAllergy} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Ghi nhận tác nhân dị ứng</h4>
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Tác nhân dị ứng</label>
              <input
                type="text"
                placeholder="Ví dụ: Hải sản, Penicillin, Phấn hoa, Lông mèo..."
                value={allergen}
                onChange={(e) => setAllergen(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Phản ứng đã gặp</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nổi mề đay, khó thở..."
                  value={allergyReaction}
                  onChange={(e) => setAllergyReaction(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Mức độ phản ứng</label>
                <select
                  value={allergySeverity}
                  onChange={(e) => setAllergySeverity(e.target.value as AllergySeverity)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                >
                  <option value="mild">Nhẹ (mẩn đỏ, ngứa)</option>
                  <option value="moderate">Trung bình (sưng phù, khó chịu)</option>
                  <option value="severe">Nặng / Sốc phản vệ</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAllergyForm(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingAllergy}
                className="px-3 py-1 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {isSubmittingAllergy ? 'Đang lưu...' : 'Lưu dị ứng'}
              </button>
            </div>
          </form>
        )}

        {allergies.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {allergies.map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{a.allergen}</span>
                  <span className="text-slate-400 text-[11px] ml-2">
                    {a.reaction ? `• Phản ứng: ${a.reaction}` : ''}
                    {a.severity ? ` (${a.severity === 'mild' ? 'Nhẹ' : a.severity === 'moderate' ? 'Vừa' : 'Nặng'})` : ''}
                  </span>
                </div>
                <button
                  onClick={() => deleteAllergyAction(a.id)}
                  className="text-slate-400 hover:text-rose-500 p-1"
                  title="Xóa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa ghi nhận dị ứng (trạng thái: chưa khai/chưa biết).</p>
        )}
      </div>

      {/* 3. THUỐC ĐANG DÙNG */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Thuốc ({medications.length})
            </h2>
          </div>
          <button
            onClick={() => setShowMedForm(true)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Thêm thuốc
          </button>
        </div>

        {/* Form thêm thuốc */}
        {showMedForm && (
          <form onSubmit={handleAddMedication} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Ghi nhận thuốc đang hoặc đã dùng</h4>
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Tên thuốc</label>
              <input
                type="text"
                placeholder="Ví dụ: Glucosamine 1500mg, Paracetamol 500mg, ..."
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Hướng dẫn dùng (nguyên văn)</label>
              <input
                type="text"
                placeholder="Ví dụ: Uống 1 viên sau ăn sáng mỗi ngày"
                value={medDosage}
                onChange={(e) => setMedDosage(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMedForm(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingMed}
                className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmittingMed ? 'Đang lưu...' : 'Lưu thuốc'}
              </button>
            </div>
          </form>
        )}

        {medications.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {medications.map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      m.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {m.status === 'active' ? 'Đang dùng' : 'Đã ngừng'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {m.dosage_instructions ? `Liều lượng: ${m.dosage_instructions}` : 'Không có ghi chú liều'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateMedicationStatusAction(m.id, m.status === 'active' ? 'stopped' : 'active')}
                    className="text-[11px] text-indigo-600 hover:underline font-medium"
                  >
                    {m.status === 'active' ? 'Đánh dấu đã ngừng' : 'Tiếp tục dùng'}
                  </button>
                  <button
                    onClick={() => deleteMedicationAction(m.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Không có thuốc đang sử dụng.</p>
        )}
      </div>
    </div>
  );
}
