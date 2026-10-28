'use client';

import React, { useState, useRef } from 'react';
import { Upload, Video, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  MAX_VIDEO_FILE_BYTES,
  ALLOWED_VIDEO_MIME_TYPES,
  type AllowedVideoMimeType,
  RECOMMENDED_CLIP_DURATION_NOTE,
} from '../contracts/media.contract';
import { reserveVideoUploadAction, finalizeVideoUploadAction } from '../server/media-actions';

interface VideoUploadDropzoneProps {
  exerciseId: string;
  variantId: string;
  onUploadSuccess: (videoId: string, fileName: string) => void;
  onClear: () => void;
  currentVideoId?: string | null;
}

export function VideoUploadDropzone({
  exerciseId,
  variantId,
  onUploadSuccess,
  onClear,
  currentVideoId,
}: VideoUploadDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(currentVideoId || null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    // 1. Kiểm tra kích thước tệp (tối đa 20 MiB = 20,971,520 bytes)
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      setErrorMessage(
        `Dung lượng tệp (${(file.size / 1024 / 1024).toFixed(1)} MiB) vượt quá giới hạn 20 MiB cho phép.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Kiểm tra định dạng MIME
    const mime = file.type as AllowedVideoMimeType;
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(mime)) {
      setErrorMessage(`Định dạng video không được hỗ trợ (${file.type}). Vui lòng chọn MP4 hoặc WebM.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);

    // Bắt đầu quá trình tải lên trực tiếp
    try {
      setIsUploading(true);
      setUploadProgress(10);

      // Bước 1: Giữ chỗ dung lượng và lấy signed upload URL từ máy chủ
      const reserveRes = await reserveVideoUploadAction({
        exerciseId,
        variantId,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        clientEstimatedDurationSeconds: null, // Không giả lập duration phía server
      });

      if (!reserveRes.success || !reserveRes.data) {
        setErrorMessage(reserveRes.message || 'Không thể cấp quyền tải lên.');
        setIsUploading(false);
        return;
      }

      const { reservationId, uploadUrl } = reserveRes.data;
      setUploadProgress(40);

      // Bước 2: Tải tệp trực tiếp vào Supabase Storage (bằng PUT request trực tiếp, không qua Server Action)
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        setErrorMessage('Tải video lên máy chủ lưu trữ thất bại (' + uploadResponse.statusText + ').');
        setIsUploading(false);
        return;
      }

      setUploadProgress(80);

      // Bước 3: Xác thực hoàn tất tải lên (Finalize)
      const finalizeRes = await finalizeVideoUploadAction({
        reservationId,
        actualSizeBytes: file.size,
        actualMimeType: file.type,
      });

      if (!finalizeRes.success || !finalizeRes.data) {
        setErrorMessage(finalizeRes.message || 'Không thể xác thực tệp đã tải lên.');
        setIsUploading(false);
        return;
      }

      setUploadProgress(100);
      setUploadedVideoId(finalizeRes.data.id);
      setUploadedFileName(file.name);
      onUploadSuccess(finalizeRes.data.id, file.name);
    } catch (err: any) {
      setErrorMessage('Lỗi trong quá trình upload: ' + (err?.message || String(err)));
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadedVideoId(null);
    setUploadedFileName(null);
    setErrorMessage(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Clip đối chiếu riêng tư (Tùy chọn)</span>
        </label>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Tối đa 20 MiB • MP4/WebM</span>
      </div>

      {uploadedVideoId ? (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <p className="font-semibold text-purple-900 dark:text-purple-200">
                {uploadedFileName || 'Video đã được tải lên sẵn sàng'}
              </p>
              <p className="text-[10px] text-purple-700 dark:text-purple-400">
                Đã xác thực và lưu trong kho lưu trữ riêng tư an toàn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="p-1 rounded text-purple-600 hover:text-red-600 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            title="Gỡ bỏ clip"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : isUploading ? (
        <div className="p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-purple-700 dark:text-purple-300 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Đang tải trực tiếp lên Storage ({uploadProgress}%)...</span>
          </div>
          <div className="w-full h-1.5 bg-purple-100 dark:bg-purple-900/60 rounded-full overflow-hidden">
            <div
              className="bg-purple-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Tải trực tiếp qua grant an toàn; không đẩy tệp lớn qua Server Actions
          </p>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleFileChange}
            className="hidden"
            id="journey-video-upload"
          />
          <label
            htmlFor="journey-video-upload"
            className="w-full p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center transition-colors block"
          >
            <Upload className="w-5 h-5 text-slate-400 group-hover:text-purple-600" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Bấm để chọn clip tự quay hoặc kéo thả vào đây
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {RECOMMENDED_CLIP_DURATION_NOTE}
            </span>
          </label>
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
