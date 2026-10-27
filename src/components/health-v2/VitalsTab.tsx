'use client';

import React, { useState } from 'react';
import { HeartPulse, PlusCircle, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import { ObservationEntity, BloodPressureEntity, MetricType } from '@/contracts';
import { deleteObservationAction } from '@/app/profile/actions';
import {
  addBloodPressureAction,
  deleteBloodPressureAction,
  addObservationDirectAction,
} from '@/lib/server/health-profile-actions';

interface VitalsTabProps {
  observations: ObservationEntity[];
  bloodPressures: BloodPressureEntity[];
}

export function VitalsTab({ observations, bloodPressures }: VitalsTabProps) {
  // Tabs trong màn hình Chỉ số: 'input' | 'chart' | 'history'
  const [activeSubTab, setActiveSubTab] = useState<'input' | 'chart' | 'history'>('input');

  // State nhập chỉ số đơn (weight, height, waist, heart rate)
  const [metricType, setMetricType] = useState<MetricType>('weight');
  const [metricValue, setMetricValue] = useState<string>('');
  const [metricUnit, setMetricUnit] = useState<string>('kg');
  const [obsNotes, setObsNotes] = useState<string>('');
  const [isSubmittingObs, setIsSubmittingObs] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);

  // State nhập huyết áp (systolic & diastolic)
  const [systolic, setSystolic] = useState<string>('120');
  const [diastolic, setDiastolic] = useState<string>('80');
  const [bpNotes, setBpNotes] = useState<string>('');
  const [isSubmittingBP, setIsSubmittingBP] = useState(false);
  const [bpError, setBpError] = useState<string | null>(null);

  // Cập nhật đơn vị tự động khi đổi loại chỉ số
  const handleMetricTypeChange = (type: MetricType) => {
    setMetricType(type);
    if (type === 'weight') setMetricUnit('kg');
    else if (type === 'height' || type === 'waist_circumference') setMetricUnit('cm');
    else if (type === 'resting_heart_rate') setMetricUnit('bpm');
    else setMetricUnit('đơn vị');
  };

  // Submit chỉ số đơn
  const handleSubmitObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingObs(true);
    setObsError(null);

    const num = parseFloat(metricValue);
    if (isNaN(num) || num <= 0) {
      setObsError('Giá trị chỉ số phải là một số dương lớn hơn 0.');
      setIsSubmittingObs(false);
      return;
    }

    const res = await addObservationDirectAction({
      metric_type: metricType,
      metric_value: num,
      metric_unit: metricUnit,
      notes: obsNotes.trim() || null,
    });

    setIsSubmittingObs(false);
    if (!res.success) {
      setObsError(res.message || 'Lỗi lưu chỉ số');
    } else {
      setMetricValue('');
      setObsNotes('');
      setActiveSubTab('history');
    }
  };

  // Submit huyết áp
  const handleSubmitBloodPressure = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBP(true);
    setBpError(null);

    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);

    const res = await addBloodPressureAction({
      systolic: sys,
      diastolic: dia,
      notes: bpNotes.trim() || null,
    });

    setIsSubmittingBP(false);
    if (!res.success) {
      setBpError(res.message || 'Lỗi lưu huyết áp');
    } else {
      setBpNotes('');
      setActiveSubTab('history');
    }
  };

  // Xóa chỉ số
  const handleDeleteObservation = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi chỉ số này để sửa sai?')) return;
    await deleteObservationAction(id);
  };

  // Xóa huyết áp
  const handleDeleteBP = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi huyết áp này?')) return;
    await deleteBloodPressureAction(id);
  };

  // Chuẩn bị dữ liệu cho biểu đồ Cân nặng (Weight Trend SVG)
  const weightReadings = observations
    .filter((o) => o.metric_type === 'weight')
    .slice(0, 10)
    .reverse();

  const minWeight = weightReadings.length > 0 ? Math.min(...weightReadings.map((r) => r.metric_value)) - 2 : 50;
  const maxWeight = weightReadings.length > 0 ? Math.max(...weightReadings.map((r) => r.metric_value)) + 2 : 80;

  // Chuẩn bị dữ liệu cho biểu đồ Huyết áp (Blood Pressure Trend SVG)
  const bpReadings = [...bloodPressures].slice(0, 10).reverse();

  return (
    <div className="space-y-5">
      {/* Thanh điều hướng sub-tab */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('input')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeSubTab === 'input'
                ? 'bg-rose-500 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Nhập nhanh
          </button>
          <button
            onClick={() => setActiveSubTab('chart')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeSubTab === 'chart'
                ? 'bg-rose-500 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Biểu đồ xu hướng
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeSubTab === 'history'
                ? 'bg-rose-500 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Lịch sử & Sửa sai ({observations.length + bloodPressures.length})
          </button>
        </div>
      </div>

      {/* 1. MÀN HÌNH NHẬP NHANH */}
      {activeSubTab === 'input' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Form nhập chỉ số thể chất (Cân nặng, Chiều cao, Vòng eo, Nhịp tim) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              Ghi nhận chỉ số thể chất
            </h3>

            <form onSubmit={handleSubmitObservation} className="space-y-3">
              {obsError && (
                <div className="p-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg">
                  {obsError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Loại chỉ số
                </label>
                <select
                  value={metricType}
                  onChange={(e) => handleMetricTypeChange(e.target.value as MetricType)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value="weight">Cân nặng (kg)</option>
                  <option value="height">Chiều cao (cm)</option>
                  <option value="waist_circumference">Vòng eo (cm)</option>
                  <option value="resting_heart_rate">Nhịp tim khi nghỉ (bpm)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Giá trị đo
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ví dụ: 68.5"
                    value={metricValue}
                    onChange={(e) => setMetricValue(e.target.value)}
                    required
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Đơn vị
                  </label>
                  <input
                    type="text"
                    value={metricUnit}
                    readOnly
                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Ghi chú bối cảnh (tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đo sáng sớm lúc chưa ăn"
                  value={obsNotes}
                  onChange={(e) => setObsNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingObs}
                className="w-full py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {isSubmittingObs ? 'Đang lưu...' : 'Lưu chỉ số'}
              </button>
            </form>
          </div>

          {/* Form nhập Huyết áp (Systolic & Diastolic) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-500" />
              Ghi nhận Huyết áp (Tâm thu / Tâm trương)
            </h3>

            <form onSubmit={handleSubmitBloodPressure} className="space-y-3">
              {bpError && (
                <div className="p-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg">
                  {bpError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Tâm thu (Systolic - mmHg)
                  </label>
                  <input
                    type="number"
                    placeholder="120"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    required
                    min="40"
                    max="300"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Số lớn (40-300)</span>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Tâm trương (Diastolic - mmHg)
                  </label>
                  <input
                    type="number"
                    placeholder="80"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    required
                    min="20"
                    max="200"
                    className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Số nhỏ (20-200)</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Ghi chú lần đo
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đo bằng máy Omron tại nhà"
                  value={bpNotes}
                  onChange={(e) => setBpNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                * Hai thành phần huyết áp luôn được lưu trong cùng 1 lần đo, không tách rời hay suy đoán.
              </div>

              <button
                type="submit"
                disabled={isSubmittingBP}
                className="w-full py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {isSubmittingBP ? 'Đang lưu...' : 'Lưu huyết áp'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. MÀN HÌNH BIỂU ĐỒ XU HƯỚNG */}
      {activeSubTab === 'chart' && (
        <div className="space-y-6">
          {/* Biểu đồ Cân nặng thuần SVG */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Diễn biến Cân nặng (kg)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Biểu đồ trực quan các lần ghi gần nhất (không nối ghép sai đơn vị).
            </p>

            {weightReadings.length >= 2 ? (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[320px] h-48 relative flex items-end pt-6 pb-6 px-4">
                  {/* Đường biểu đồ SVG */}
                  <svg className="w-full h-full overflow-visible">
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      points={weightReadings
                        .map((w, idx) => {
                          const x = (idx / (weightReadings.length - 1)) * 300;
                          const range = maxWeight - minWeight || 1;
                          const y = 140 - ((w.metric_value - minWeight) / range) * 120;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                    {weightReadings.map((w, idx) => {
                      const x = (idx / (weightReadings.length - 1)) * 300;
                      const range = maxWeight - minWeight || 1;
                      const y = 140 - ((w.metric_value - minWeight) / range) * 120;
                      return (
                        <g key={w.id}>
                          <circle cx={x} cy={y} r="4" fill="#10b981" />
                          <text x={x} y={y - 8} fontSize="10" textAnchor="middle" fill="#64748b">
                            {w.metric_value}
                          </text>
                          <text x={x} y={155} fontSize="9" textAnchor="middle" fill="#94a3b8">
                            {new Date(w.observed_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center italic">
                Cần ít nhất 2 lần đo cân nặng để hiển thị đường xu hướng.
              </p>
            )}
          </div>

          {/* Biểu đồ Huyết áp */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-500" />
              Diễn biến Huyết áp (mmHg)
            </h3>
            <div className="flex items-center gap-4 text-xs mb-4">
              <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Tâm thu (Systolic)
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Tâm trương (Diastolic)
              </span>
            </div>

            {bpReadings.length >= 2 ? (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[320px] h-48 relative flex items-end pt-6 pb-6 px-4">
                  <svg className="w-full h-full overflow-visible">
                    {/* Đường Systolic */}
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2"
                      points={bpReadings
                        .map((b, idx) => {
                          const x = (idx / (bpReadings.length - 1)) * 300;
                          const y = 140 - ((b.systolic - 50) / 130) * 120;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                    {/* Đường Diastolic */}
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      points={bpReadings
                        .map((b, idx) => {
                          const x = (idx / (bpReadings.length - 1)) * 300;
                          const y = 140 - ((b.diastolic - 50) / 130) * 120;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                    {bpReadings.map((b, idx) => {
                      const x = (idx / (bpReadings.length - 1)) * 300;
                      const ySys = 140 - ((b.systolic - 50) / 130) * 120;
                      const yDia = 140 - ((b.diastolic - 50) / 130) * 120;
                      return (
                        <g key={b.id}>
                          <circle cx={x} cy={ySys} r="3.5" fill="#f43f5e" />
                          <circle cx={x} cy={yDia} r="3.5" fill="#3b82f6" />
                          <text x={x} y={155} fontSize="9" textAnchor="middle" fill="#94a3b8">
                            {new Date(b.measured_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center italic">
                Cần ít nhất 2 lần đo huyết áp để hiển thị biểu đồ so sánh.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. MÀN HÌNH LỊCH SỬ & SỬA SAI */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Lịch sử các lần đo
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Mỗi lần đo tạo một bản ghi độc lập. Bạn có thể xóa bản ghi nhập nhầm bất cứ lúc nào.
            </p>

            {/* Bảng Huyết áp */}
            <div className="mb-5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Huyết áp ({bloodPressures.length})
              </span>
              {bloodPressures.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2">Ngày đo</th>
                        <th className="p-2">Tâm thu / Tâm trương</th>
                        <th className="p-2">Ghi chú</th>
                        <th className="p-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {bloodPressures.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="p-2 text-slate-500">
                            {new Date(b.measured_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-2 font-semibold text-slate-900 dark:text-slate-100">
                            {b.systolic} / {b.diastolic} mmHg
                          </td>
                          <td className="p-2 text-slate-400">{b.notes || '--'}</td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => handleDeleteBP(b.id)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Xóa bản ghi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Chưa có bản ghi huyết áp nào.</p>
              )}
            </div>

            {/* Bảng Chỉ số thể chất */}
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Chỉ số thể chất ({observations.length})
              </span>
              {observations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2">Ngày đo</th>
                        <th className="p-2">Loại chỉ số</th>
                        <th className="p-2">Giá trị</th>
                        <th className="p-2">Ghi chú</th>
                        <th className="p-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {observations.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/50">
                          <td className="p-2 text-slate-500">
                            {new Date(o.observed_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-2 font-medium text-slate-800 dark:text-slate-200">
                            {o.metric_type === 'weight' ? 'Cân nặng' :
                             o.metric_type === 'height' ? 'Chiều cao' :
                             o.metric_type === 'waist_circumference' ? 'Vòng eo' :
                             o.metric_type === 'resting_heart_rate' ? 'Nhịp tim nghỉ' : o.metric_type}
                          </td>
                          <td className="p-2 font-semibold text-slate-900 dark:text-slate-100">
                            {o.metric_value} {o.metric_unit}
                          </td>
                          <td className="p-2 text-slate-400">{o.notes || '--'}</td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => handleDeleteObservation(o.id)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Xóa bản ghi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Chưa có chỉ số thể chất nào.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
