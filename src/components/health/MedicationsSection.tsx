'use client';

import React, { useState, useTransition } from 'react';
import { Pill, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { MedicationEntity, AllergyEntity, MedicationStatus } from '@/contracts';
import {
  addMedicationAction,
  updateMedicationStatusAction,
  deleteMedicationAction,
  addAllergyAction,
  deleteAllergyAction,
} from '@/lib/server/health-profile-actions';

interface MedicationsSectionProps {
  medications: MedicationEntity[];
  allergies: AllergyEntity[];
  isConfigured: boolean;
}

export function MedicationsSection({
  medications,
  allergies,
  isConfigured,
}: MedicationsSectionProps) {
  const [activeTab, setActiveTab] = useState<'medications' | 'allergies'>('medications');
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isAllergyModalOpen, setIsAllergyModalOpen] = useState(false);

  // Form Medication
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medStatus, setMedStatus] = useState<MedicationStatus>('active');
  const [medNotes, setMedNotes] = useState('');
  const [medError, setMedError] = useState<string | null>(null);

  // Form Allergy
  const [allergen, setAllergen] = useState('');
  const [reaction, setReaction] = useState('');
  const [allergyError, setAllergyError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    setMedError(null);
    if (!medName.trim()) {
      setMedError('Vui lòng nhập tên thuốc.');
      return;
    }

    startTransition(async () => {
      const res = await addMedicationAction({
        name: medName.trim(),
        dosage_instructions: medDosage.trim() || null,
        status: medStatus,
        notes: medNotes.trim() || null,
      });

      if (res.success) {
        setIsMedModalOpen(false);
        setMedName('');
        setMedDosage('');
        setMedNotes('');
      } else {
        setMedError(res.message || 'Lỗi lưu thông tin thuốc.');
      }
    });
  };

  const handleAddAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    setAllergyError(null);
    if (!allergen.trim()) {
      setAllergyError('Vui lòng nhập tác nhân dị ứng.');
      return;
    }

    startTransition(async () => {
      const res = await addAllergyAction({
        allergen: allergen.trim(),
        reaction: reaction.trim() || null,
        status: 'known',
      });

      if (res.success) {
        setIsAllergyModalOpen(false);
        setAllergen('');
        setReaction('');
      } else {
        setAllergyError(res.message || 'Lỗi lưu dị ứng.');
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Thuốc Đang Dùng & Dị Ứng
            </h3>
            <p className="text-[11px] text-slate-500">
              Lưu giữ thông tin thuốc và cảnh báo dị ứng tự khai
            </p>
          </div>
        </div>

        <button
          onClick={() => (activeTab === 'medications' ? setIsMedModalOpen(true) : setIsAllergyModalOpen(true))}
          className="py-1.5 px-3 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{activeTab === 'medications' ? 'Thêm thuốc' : 'Thêm dị ứng'}</span>
        </button>
      </div>

      {/* Tabs chuyển đổi Thuốc / Dị ứng */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab('medications')}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeTab === 'medications'
              ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Thuốc ({medications.length})
        </button>
        <button
          onClick={() => setActiveTab('allergies')}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeTab === 'allergies'
              ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Dị ứng ({allergies.length})
        </button>
      </div>

      {/* Nội dung danh sách */}
      {activeTab === 'medications' ? (
        medications.length === 0 ? (
          <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500">
            Chưa khai báo thuốc nào đang sử dụng.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {medications.map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {m.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        m.status === 'active'
                          ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {m.status === 'active' ? 'Đang dùng' : 'Đã ngừng'}
                    </span>
                  </div>
                  {m.dosage_instructions && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Liều: {m.dosage_instructions}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      startTransition(() => {
                        updateMedicationStatusAction(
                          m.id,
                          m.status === 'active' ? 'stopped' : 'active'
                        );
                      })
                    }
                    className="text-[10px] text-slate-500 hover:text-teal-600 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700"
                  >
                    {m.status === 'active' ? 'Đánh dấu ngừng' : 'Kích hoạt lại'}
                  </button>
                  <button
                    onClick={() =>
                      startTransition(() => {
                        deleteMedicationAction(m.id);
                      })
                    }
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : allergies.length === 0 ? (
        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500">
          Chưa ghi nhận dị ứng nào.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {allergies.map((a) => (
            <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  ⚠️ {a.allergen}
                </span>
                {a.reaction && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Phản ứng: {a.reaction}
                  </p>
                )}
              </div>
              <button
                onClick={() =>
                  startTransition(() => {
                    deleteAllergyAction(a.id);
                  })
                }
                className="p-1 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm Thuốc */}
      {isMedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-600" />
                <span>Thêm Thuốc Đang Dùng</span>
              </h4>
              <button onClick={() => setIsMedModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddMedication} className="space-y-3 text-xs">
              {medError && <div className="p-2 text-rose-600 bg-rose-50 rounded-xl">{medError}</div>}
              <div>
                <label className="font-semibold block mb-1">Tên thuốc:</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Ví dụ: Panadol, Glucosamine..."
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Hướng dẫn dùng (nguyên văn):</label>
                <input
                  type="text"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  placeholder="Ví dụ: 1 viên sau ăn sáng..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsMedModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 rounded-xl bg-teal-600 text-white font-bold"
                >
                  Lưu thuốc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm Dị Ứng */}
      {isAllergyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Thêm Dị Ứng Tự Khai</span>
              </h4>
              <button onClick={() => setIsAllergyModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddAllergy} className="space-y-3 text-xs">
              {allergyError && <div className="p-2 text-rose-600 bg-rose-50 rounded-xl">{allergyError}</div>}
              <div>
                <label className="font-semibold block mb-1">Tác nhân dị ứng:</label>
                <input
                  type="text"
                  value={allergen}
                  onChange={(e) => setAllergen(e.target.value)}
                  placeholder="Ví dụ: Kháng sinh Penicillin, Hải sản, Phấn hoa..."
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Phản ứng gặp phải:</label>
                <input
                  type="text"
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  placeholder="Ví dụ: Nổi mề đay, khó thở nhẹ..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAllergyModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold"
                >
                  Lưu dị ứng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
