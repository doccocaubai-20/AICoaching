'use client';

import React, { useState } from 'react';
import { FileText, Calendar, PlusCircle, Trash2, Download, Paperclip, ExternalLink } from 'lucide-react';
import { HealthEventEntity, HealthDocumentEntity, HealthEventType, HealthDocumentFileType } from '@/contracts';
import {
  addHealthEventAction,
  deleteHealthEventAction,
  createHealthDocumentAction,
  deleteHealthDocumentAction,
} from '@/lib/server/health-profile-actions';

interface EventsAndDocumentsTabProps {
  healthEvents: HealthEventEntity[];
  documents: HealthDocumentEntity[];
}

export function EventsAndDocumentsTab({ healthEvents, documents }: EventsAndDocumentsTabProps) {
  // Modal / Form Thêm sự kiện
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventType, setEventType] = useState<HealthEventType>('checkup');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [facilityName, setFacilityName] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  // Modal / Form Thêm tài liệu
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docEventId, setDocEventId] = useState<string>('');
  const [docFileName, setDocFileName] = useState('');
  const [docFileType, setDocFileType] = useState<HealthDocumentFileType>('application/pdf');
  const [docSizeBytes, setDocSizeBytes] = useState<number>(1024 * 500); // 500KB giả định
  const [docNotes, setDocNotes] = useState('');
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEvent(true);

    await addHealthEventAction({
      event_type: eventType,
      event_date: eventDate,
      facility_name: facilityName.trim() || null,
      notes: eventNotes.trim() || null,
    });

    setIsSubmittingEvent(false);
    setFacilityName('');
    setEventNotes('');
    setShowEventForm(false);
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docFileName.trim()) return;
    setIsSubmittingDoc(true);
    setDocError(null);

    // Đường dẫn ảo hóa trong storage private
    const randomKey = Math.random().toString(36).substring(2, 10);
    const fakePath = `health-docs/${randomKey}-${docFileName.trim()}`;

    const res = await createHealthDocumentAction({
      event_id: docEventId || null,
      title: docTitle.trim(),
      file_name: docFileName.trim(),
      file_type: docFileType,
      file_size_bytes: docSizeBytes,
      storage_path: fakePath,
      notes: docNotes.trim() || null,
    });

    setIsSubmittingDoc(false);
    if (!res.success) {
      setDocError(res.message || 'Lỗi khi lưu tài liệu');
    } else {
      setDocTitle('');
      setDocFileName('');
      setDocNotes('');
      setShowDocForm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SỰ KIỆN Y TẾ & KHÁM BỆNH */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Sự kiện khám & Xét nghiệm ({healthEvents.length})
            </h2>
          </div>
          <button
            onClick={() => setShowEventForm(true)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Thêm sự kiện
          </button>
        </div>

        {/* Form thêm sự kiện */}
        {showEventForm && (
          <form onSubmit={handleAddEvent} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Thêm sự kiện khám mới</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Loại sự kiện</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as HealthEventType)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                >
                  <option value="checkup">Khám sức khỏe tổng quát</option>
                  <option value="lab_test">Xét nghiệm máu / sinh hóa</option>
                  <option value="vaccination">Tiêm chủng / Vaccine</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Ngày thực hiện</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Cơ sở y tế / Bệnh viện</label>
              <input
                type="text"
                placeholder="Ví dụ: Bệnh viện Đại học Y Dược, Phòng khám..."
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Ghi chú kết quả</label>
              <input
                type="text"
                placeholder="Ví dụ: Bác sĩ khuyên tăng cường vận động, chỉ số mỡ máu tốt..."
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEventForm(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingEvent}
                className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmittingEvent ? 'Đang lưu...' : 'Lưu sự kiện'}
              </button>
            </div>
          </form>
        )}

        {healthEvents.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {healthEvents.map((ev) => (
              <div key={ev.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {ev.event_type === 'checkup' ? 'Khám tổng quát' :
                       ev.event_type === 'lab_test' ? 'Xét nghiệm' :
                       ev.event_type === 'vaccination' ? 'Tiêm chủng' : 'Sự kiện y tế'}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Ngày: {new Date(ev.event_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Nơi thực hiện: {ev.facility_name || 'Không ghi rõ'} {ev.notes ? `• ${ev.notes}` : ''}
                  </p>
                </div>

                <button
                  onClick={() => deleteHealthEventAction(ev.id)}
                  className="text-slate-400 hover:text-rose-500 p-1"
                  title="Xóa sự kiện"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có sự kiện khám hoặc xét nghiệm nào.</p>
        )}
      </div>

      {/* 2. TÀI LIỆU SỨC KHỎE & PHIẾU KHÁM */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Tài liệu y tế & Phiếu khám ({documents.length})
            </h2>
          </div>
          <button
            onClick={() => setShowDocForm(true)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 transition"
          >
            <Paperclip className="w-3.5 h-3.5" /> Lưu tài liệu mới
          </button>
        </div>

        {/* Form thêm tài liệu */}
        {showDocForm && (
          <form onSubmit={handleAddDocument} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Ghi nhận tài liệu sức khỏe</h4>
            {docError && (
              <div className="p-2 text-xs text-rose-600 bg-rose-50 rounded-lg">
                {docError}
              </div>
            )}

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Tên tài liệu / Tiêu đề</label>
              <input
                type="text"
                placeholder="Ví dụ: Phiếu kết quả xét nghiệm máu 10/2026, Phim X-quang khớp gối..."
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Tên tệp gốc</label>
                <input
                  type="text"
                  placeholder="xet-nghiem-2026.pdf"
                  value={docFileName}
                  onChange={(e) => setDocFileName(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Định dạng tệp</label>
                <select
                  value={docFileType}
                  onChange={(e) => setDocFileType(e.target.value as HealthDocumentFileType)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                >
                  <option value="application/pdf">Tài liệu PDF (.pdf)</option>
                  <option value="image/jpeg">Ảnh JPEG (.jpg, .jpeg)</option>
                  <option value="image/png">Ảnh PNG (.png)</option>
                </select>
              </div>
            </div>

            {healthEvents.length > 0 && (
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Liên kết sự kiện (tùy chọn)</label>
                <select
                  value={docEventId}
                  onChange={(e) => setDocEventId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                >
                  <option value="">-- Không liên kết sự kiện --</option>
                  {healthEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.event_date} - {ev.facility_name || ev.event_type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Ghi chú</label>
              <input
                type="text"
                placeholder="Ví dụ: Bản scan từ bệnh viện..."
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDocForm(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingDoc}
                className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmittingDoc ? 'Đang lưu...' : 'Lưu tài liệu'}
              </button>
            </div>
          </form>
        )}

        {documents.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => (
              <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{doc.title}</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                      {doc.file_type.split('/')[1]}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5 pl-6">
                    {doc.file_name} • {(doc.file_size_bytes / 1024).toFixed(0)} KB • Ngày tạo: {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => alert(`Đường dẫn tài liệu bảo mật: ${doc.storage_path}`)}
                    className="text-indigo-600 hover:text-indigo-700 p-1 flex items-center gap-0.5"
                    title="Mở tài liệu"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteHealthDocumentAction(doc.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="Xóa tài liệu"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có tài liệu hoặc phiếu khám nào được lưu.</p>
        )}
      </div>
    </div>
  );
}
