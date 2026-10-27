'use client';

import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  PlusCircle,
  Trash2,
  Download,
  Paperclip,
  ExternalLink,
  UploadCloud,
  Edit3,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { HealthEventEntity, HealthDocumentEntity, HealthEventType } from '@/contracts';
import {
  addHealthEventAction,
  deleteHealthEventAction,
  uploadHealthDocumentAction,
  getHealthDocumentSignedUrlAction,
  renameHealthDocumentAction,
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

  // Modal / Form Tải lên tài liệu thật (E2)
  const [showDocForm, setShowDocForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docEventId, setDocEventId] = useState<string>('');
  const [docNotes, setDocNotes] = useState('');
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Trạng thái thao tác tài liệu (Đổi tên / Xóa / Tải URL)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState('');
  const [isDeletingDocId, setIsDeletingDocId] = useState<string | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file && !docTitle) {
      // Tự động gợi ý tiêu đề từ tên tệp
      setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    setDocError(null);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setDocError('Vui lòng chọn một tệp tài liệu y tế (PDF, JPG, PNG).');
      return;
    }

    setIsSubmittingDoc(true);
    setDocError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', docTitle.trim() || selectedFile.name);
    if (docEventId) formData.append('event_id', docEventId);
    if (docNotes.trim()) formData.append('notes', docNotes.trim());

    const res = await uploadHealthDocumentAction(formData);

    setIsSubmittingDoc(false);
    if (!res.success) {
      setDocError(res.message || 'Lỗi khi tải lên tài liệu.');
    } else {
      setSelectedFile(null);
      setDocTitle('');
      setDocEventId('');
      setDocNotes('');
      setShowDocForm(false);
      setActionMessage({ type: 'success', text: 'Đã tải lên và lưu trữ tài liệu y tế thành công.' });
    }
  };

  const handleOpenDocument = async (docId: string) => {
    setActionMessage(null);
    const res = await getHealthDocumentSignedUrlAction(docId);
    if (res.success && res.data?.signedUrl) {
      window.open(res.data.signedUrl, '_blank', 'noopener,noreferrer');
    } else {
      setActionMessage({ type: 'error', text: res.message || 'Không thể tạo liên kết truy cập tài liệu.' });
    }
  };

  const handleStartRename = (doc: HealthDocumentEntity) => {
    setRenamingDocId(doc.id);
    setRenameTitleInput(doc.title);
  };

  const handleSaveRename = async (docId: string) => {
    if (!renameTitleInput.trim()) return;
    const res = await renameHealthDocumentAction(docId, renameTitleInput.trim());
    if (res.success) {
      setRenamingDocId(null);
      setActionMessage({ type: 'success', text: 'Đã đổi tên tài liệu.' });
    } else {
      setActionMessage({ type: 'error', text: res.message || 'Lỗi đổi tên tài liệu.' });
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi kho lưu trữ?')) return;
    setIsDeletingDocId(docId);
    setActionMessage(null);

    const res = await deleteHealthDocumentAction(docId);
    setIsDeletingDocId(null);

    if (res.success) {
      setActionMessage({ type: 'success', text: 'Đã xóa tài liệu khỏi hệ thống.' });
    } else {
      setActionMessage({
        type: 'error',
        text: res.message || 'Không thể xóa tài liệu. Thông tin tài liệu được giữ lại để bạn thử lại.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Thông báo thao tác chung */}
      {actionMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Đóng
          </button>
        </div>
      )}

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
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Thêm sự kiện</span>
          </button>
        </div>

        {/* Modal / Form thêm sự kiện */}
        {showEventForm && (
          <form onSubmit={handleAddEvent} className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3 text-xs border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Ghi nhận sự kiện y tế mới</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">Loại sự kiện</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as HealthEventType)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-transparent"
                >
                  <option value="checkup">Khám sức khỏe tổng quát</option>
                  <option value="lab_test">Xét nghiệm máu / nước tiểu / hình ảnh</option>
                  <option value="vaccination">Tiêm chủng / Vaccine</option>
                  <option value="other">Sự kiện y tế khác</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">Ngày thực hiện</label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-600 dark:text-slate-400 block mb-1">Cơ sở y tế / Bệnh viện / Phòng khám (tùy chọn)</label>
              <input
                type="text"
                placeholder="Ví dụ: Bệnh viện Đại học Y Dược TP.HCM"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-slate-400 block mb-1">Ghi chú kết quả hoặc dặn dò của bác sĩ</label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Chỉ số men gan hơi cao nhẹ, bác sĩ dặn hạn chế thức khuya..."
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
              <div key={ev.id} className="py-2.5 flex items-start justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {ev.event_type === 'checkup' && 'Khám tổng quát'}
                      {ev.event_type === 'lab_test' && 'Xét nghiệm'}
                      {ev.event_type === 'vaccination' && 'Tiêm chủng'}
                      {ev.event_type === 'other' && 'Sự kiện y tế'}
                    </span>
                    <span className="text-slate-400">• Ngày: {ev.event_date}</span>
                  </div>
                  {ev.facility_name && (
                    <p className="text-slate-500 text-[11px] mt-0.5">Cơ sở: {ev.facility_name}</p>
                  )}
                  {ev.notes && (
                    <p className="text-slate-400 text-[11px] italic mt-0.5">{ev.notes}</p>
                  )}
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

      {/* 2. TÀI LIỆU Y TẾ & PHIẾU KHÁM (E2 LUỒNG TẬP TIN THỰC) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Tài liệu & Phiếu khám ({documents.length})
            </h2>
          </div>
          <button
            onClick={() => setShowDocForm(true)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 transition"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Tải tệp lên</span>
          </button>
        </div>

        {/* Modal / Form tải tệp thật */}
        {showDocForm && (
          <form onSubmit={handleUploadDocument} className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3 text-xs border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>Tải tệp tài liệu y tế vào bộ nhớ bảo mật (Private Storage)</span>
            </h3>

            {docError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{docError}</span>
              </div>
            )}

            {/* Bộ chọn tệp thật */}
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                Chọn tệp từ thiết bị (PDF, JPEG, PNG • Tối đa 4 MiB)
              </label>
              <input
                type="file"
                required
                accept=".pdf,image/jpeg,image/png"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-slate-300 dark:border-slate-700 rounded-lg p-1 bg-transparent"
              />
              {selectedFile && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Đã chọn: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedFile.name}</span> ({((selectedFile.size) / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Tiêu đề tài liệu</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Kết quả xét nghiệm máu tổng quát 10/2026"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            {healthEvents.length > 0 && (
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Liên kết sự kiện y tế (tùy chọn)</label>
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
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Ghi chú tệp (tùy chọn)</label>
              <input
                type="text"
                placeholder="Ví dụ: Phiếu kết quả bác sĩ đưa trực tiếp..."
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 bg-transparent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDocForm(false);
                  setDocError(null);
                }}
                className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingDoc || !selectedFile}
                className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isSubmittingDoc ? 'Đang tải lên...' : 'Tải lên & Lưu trữ'}
              </button>
            </div>
          </form>
        )}

        {documents.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => (
              <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="min-w-0 flex-1">
                  {renamingDocId === doc.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameTitleInput}
                        onChange={(e) => setRenameTitleInput(e.target.value)}
                        className="text-xs rounded border border-indigo-400 px-2 py-0.5 bg-transparent text-slate-900 dark:text-slate-100"
                      />
                      <button
                        onClick={() => handleSaveRename(doc.id)}
                        className="px-2 py-0.5 bg-indigo-600 text-white text-[11px] rounded"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => setRenamingDocId(null)}
                        className="px-2 py-0.5 text-slate-500 text-[11px]"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{doc.title}</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                          {doc.file_type.split('/')[1]}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 pl-6 truncate">
                        {doc.file_name} • {(doc.file_size_bytes / 1024).toFixed(0)} KB • Ngày: {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                        {doc.notes && ` • ${doc.notes}`}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenDocument(doc.id)}
                    className="text-indigo-600 hover:text-indigo-700 p-1 flex items-center gap-1 text-[11px] font-medium"
                    title="Mở tài liệu bằng liên kết bảo mật có thời hạn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở</span>
                  </button>
                  <button
                    onClick={() => handleStartRename(doc)}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                    title="Đổi tên tài liệu"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    disabled={isDeletingDocId === doc.id}
                    className="text-slate-400 hover:text-rose-500 p-1 disabled:opacity-50"
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
