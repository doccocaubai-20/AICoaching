'use client';

import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  Bookmark,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { JourneyVideoAsset, TimestampNote } from '../contracts/media.contract';
import { addVideoTimestampNoteAction, removeVideoTimestampNoteAction } from '../server/media-actions';

interface ClipViewData {
  video: JourneyVideoAsset;
  signedUrl: string;
  attemptTitle: string;
  attemptDate: string;
  metricsText: string;
}

interface ComparisonVideoPlayerProps {
  clipA: ClipViewData;
  clipB: ClipViewData;
  onDeleteClip?: (videoId: string) => void;
}

export function ComparisonVideoPlayer({
  clipA,
  clipB,
  onDeleteClip,
}: ComparisonVideoPlayerProps) {
  // Video Elements
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  // Trạng thái phát riêng từng clip
  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [isMutedA, setIsMutedA] = useState(true);
  const [isMutedB, setIsMutedB] = useState(true);
  const [speedA, setSpeedA] = useState<number>(1);
  const [speedB, setSpeedB] = useState<number>(1);
  const [currentTimeA, setCurrentTimeA] = useState<number>(0);
  const [currentTimeB, setCurrentTimeB] = useState<number>(0);

  // Mốc đồng bộ (Sync Points)
  const [syncPointA, setSyncPointA] = useState<number>(0);
  const [syncPointB, setSyncPointB] = useState<number>(0);
  const [isSyncPlaying, setIsSyncPlaying] = useState<boolean>(false);

  // Lỗi phát
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  // Timestamp notes
  const [notesA, setNotesA] = useState<TimestampNote[]>(clipA.video.timestampNotes || []);
  const [notesB, setNotesB] = useState<TimestampNote[]>(clipB.video.timestampNotes || []);
  const [newNoteTextA, setNewNoteTextA] = useState('');
  const [newNoteTextB, setNewNoteTextB] = useState('');

  // Điều khiển Clip A
  const togglePlayA = () => {
    if (!videoARef.current) return;
    if (isPlayingA) {
      videoARef.current.pause();
      setIsPlayingA(false);
    } else {
      videoARef.current.play().catch((err) => setErrorA('Trình duyệt chặn tự động phát: ' + err.message));
      setIsPlayingA(true);
    }
  };

  // Điều khiển Clip B
  const togglePlayB = () => {
    if (!videoBRef.current) return;
    if (isPlayingB) {
      videoBRef.current.pause();
      setIsPlayingB(false);
    } else {
      videoBRef.current.play().catch((err) => setErrorB('Trình duyệt chặn tự động phát: ' + err.message));
      setIsPlayingB(true);
    }
  };

  // Đổi tốc độ phát
  const changeSpeedA = (rate: number) => {
    setSpeedA(rate);
    if (videoARef.current) videoARef.current.playbackRate = rate;
  };

  const changeSpeedB = (rate: number) => {
    setSpeedB(rate);
    if (videoBRef.current) videoBRef.current.playbackRate = rate;
  };

  // Phát đồng bộ từ mốc (Sync Play)
  const handleSyncPlay = () => {
    if (!videoARef.current || !videoBRef.current) return;

    if (isSyncPlaying) {
      videoARef.current.pause();
      videoBRef.current.pause();
      setIsPlayingA(false);
      setIsPlayingB(false);
      setIsSyncPlaying(false);
    } else {
      // Tua cả 2 video về mốc đồng bộ đã đặt
      videoARef.current.currentTime = syncPointA;
      videoBRef.current.currentTime = syncPointB;

      Promise.all([
        videoARef.current.play(),
        videoBRef.current.play(),
      ])
        .then(() => {
          setIsPlayingA(true);
          setIsPlayingB(true);
          setIsSyncPlaying(true);
        })
        .catch((err) => {
          setIsSyncPlaying(false);
        });
    }
  };

  // Thêm Timestamp Note cho A
  const handleAddNoteA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTextA.trim()) return;
    const time = videoARef.current ? videoARef.current.currentTime : 0;
    const res = await addVideoTimestampNoteAction(clipA.video.id, time, newNoteTextA);
    if (res.success && res.data) {
      setNotesA(res.data);
      setNewNoteTextA('');
    }
  };

  // Thêm Timestamp Note cho B
  const handleAddNoteB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTextB.trim()) return;
    const time = videoBRef.current ? videoBRef.current.currentTime : 0;
    const res = await addVideoTimestampNoteAction(clipB.video.id, time, newNoteTextB);
    if (res.success && res.data) {
      setNotesB(res.data);
      setNewNoteTextB('');
    }
  };

  const jumpToTimeA = (t: number) => {
    if (videoARef.current) {
      videoARef.current.currentTime = t;
    }
  };

  const jumpToTimeB = (t: number) => {
    if (videoBRef.current) {
      videoBRef.current.currentTime = t;
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner giới hạn đồng bộ */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Giới hạn đồng bộ video trên trình duyệt:
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Tính năng phát đồng bộ phụ thuộc vào trình duyệt và phần cứng thiết bị; có thể có độ lệch mili-giây và không cam kết khớp chính xác từng khung hình (frame-accurate) trên mọi thiết bị. Không áp dụng công nghệ AI tự động chấm form hay skeleton tracking.
          </p>
        </div>
      </div>

      {/* Thanh điều khiển đồng bộ trung tâm */}
      <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSyncPlay}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            {isSyncPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isSyncPlaying ? 'Tạm dừng đồng bộ' : 'Phát đồng bộ từ mốc'}
          </button>
          <div className="text-xs text-purple-900 dark:text-purple-200">
            <span>Mốc A: <strong>{syncPointA.toFixed(1)}s</strong></span>
            <span className="mx-2">•</span>
            <span>Mốc B: <strong>{syncPointB.toFixed(1)}s</strong></span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (videoARef.current) videoARef.current.currentTime = 0;
            if (videoBRef.current) videoBRef.current.currentTime = 0;
            setIsPlayingA(false);
            setIsPlayingB(false);
            setIsSyncPlaying(false);
          }}
          className="inline-flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300 hover:underline"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Tua lại đầu cả hai clip
        </button>
      </div>

      {/* Khung xem 2 Video cạnh nhau (Side-by-side) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Clip A */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 uppercase">
                Clip Trước (A)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {clipA.attemptTitle}
              </h3>
              <p className="text-[11px] text-slate-500">
                {clipA.attemptDate} • {clipA.metricsText}
              </p>
            </div>
            {onDeleteClip && (
              <button
                type="button"
                onClick={() => onDeleteClip(clipA.video.id)}
                className="text-slate-400 hover:text-red-500 p-1"
                title="Xóa clip này"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Video Player A */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
            {errorA ? (
              <div className="text-center p-4 text-xs text-red-400 space-y-1">
                <AlertTriangle className="w-6 h-6 mx-auto text-red-500" />
                <p>Không thể phát video trên trình duyệt này.</p>
                <p className="text-[10px] text-slate-400">{errorA}</p>
              </div>
            ) : (
              <video
                ref={videoARef}
                src={clipA.signedUrl}
                muted={isMutedA}
                playsInline
                onTimeUpdate={() => {
                  if (videoARef.current) setCurrentTimeA(videoARef.current.currentTime);
                }}
                onEnded={() => setIsPlayingA(false)}
                onError={(e) => setErrorA('Định dạng tệp không phát được hoặc liên kết đã hết hạn (TTL 5 phút).')}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Điều khiển riêng A */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayA}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200"
                >
                  {isPlayingA ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMutedA(!isMutedA)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  {isMutedA ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[11px] font-mono text-slate-500">
                  {currentTimeA.toFixed(1)}s
                </span>
              </div>

              {/* Tốc độ phát A */}
              <div className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-slate-400" />
                {[0.5, 1, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => changeSpeedA(r)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      speedA === r
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* Nút đặt mốc đồng bộ A */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setSyncPointA(currentTimeA)}
                className="text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
              >
                📍 Đặt mốc đồng bộ A tại {currentTimeA.toFixed(1)}s
              </button>
            </div>
          </div>

          {/* Ghi chú mốc thời gian A */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Bookmark className="w-3 h-3 text-purple-500" /> Ghi chú kỹ thuật mốc thời gian (Clip A):
            </span>

            {notesA.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {notesA.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => jumpToTimeA(n.timeSeconds)}
                    className="p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded text-[11px] flex items-center justify-between cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  >
                    <span className="font-mono text-purple-600 font-semibold">{n.timeSeconds.toFixed(1)}s:</span>
                    <span className="text-slate-700 dark:text-slate-300 ml-1.5 flex-1">{n.note}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">Chưa có ghi chú timestamp nào.</p>
            )}

            <form onSubmit={handleAddNoteA} className="flex gap-1.5 pt-1">
              <input
                type="text"
                placeholder={`Ghi chú tại ${currentTimeA.toFixed(1)}s...`}
                value={newNoteTextA}
                onChange={(e) => setNewNoteTextA(e.target.value)}
                maxLength={300}
                className="flex-1 px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Thêm
              </button>
            </form>
          </div>
        </div>

        {/* Clip B */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 uppercase">
                Clip Hiện Tại / Mới Hơn (B)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {clipB.attemptTitle}
              </h3>
              <p className="text-[11px] text-slate-500">
                {clipB.attemptDate} • {clipB.metricsText}
              </p>
            </div>
            {onDeleteClip && (
              <button
                type="button"
                onClick={() => onDeleteClip(clipB.video.id)}
                className="text-slate-400 hover:text-red-500 p-1"
                title="Xóa clip này"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Video Player B */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
            {errorB ? (
              <div className="text-center p-4 text-xs text-red-400 space-y-1">
                <AlertTriangle className="w-6 h-6 mx-auto text-red-500" />
                <p>Không thể phát video trên trình duyệt này.</p>
                <p className="text-[10px] text-slate-400">{errorB}</p>
              </div>
            ) : (
              <video
                ref={videoBRef}
                src={clipB.signedUrl}
                muted={isMutedB}
                playsInline
                onTimeUpdate={() => {
                  if (videoBRef.current) setCurrentTimeB(videoBRef.current.currentTime);
                }}
                onEnded={() => setIsPlayingB(false)}
                onError={(e) => setErrorB('Định dạng tệp không phát được hoặc liên kết đã hết hạn (TTL 5 phút).')}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Điều khiển riêng B */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayB}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200"
                >
                  {isPlayingB ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMutedB(!isMutedB)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  {isMutedB ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[11px] font-mono text-slate-500">
                  {currentTimeB.toFixed(1)}s
                </span>
              </div>

              {/* Tốc độ phát B */}
              <div className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-slate-400" />
                {[0.5, 1, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => changeSpeedB(r)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      speedB === r
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* Nút đặt mốc đồng bộ B */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setSyncPointB(currentTimeB)}
                className="text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
              >
                📍 Đặt mốc đồng bộ B tại {currentTimeB.toFixed(1)}s
              </button>
            </div>
          </div>

          {/* Ghi chú mốc thời gian B */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Bookmark className="w-3 h-3 text-emerald-500" /> Ghi chú kỹ thuật mốc thời gian (Clip B):
            </span>

            {notesB.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {notesB.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => jumpToTimeB(n.timeSeconds)}
                    className="p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded text-[11px] flex items-center justify-between cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  >
                    <span className="font-mono text-emerald-600 font-semibold">{n.timeSeconds.toFixed(1)}s:</span>
                    <span className="text-slate-700 dark:text-slate-300 ml-1.5 flex-1">{n.note}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">Chưa có ghi chú timestamp nào.</p>
            )}

            <form onSubmit={handleAddNoteB} className="flex gap-1.5 pt-1">
              <input
                type="text"
                placeholder={`Ghi chú tại ${currentTimeB.toFixed(1)}s...`}
                value={newNoteTextB}
                onChange={(e) => setNewNoteTextB(e.target.value)}
                maxLength={300}
                className="flex-1 px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Thêm
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
