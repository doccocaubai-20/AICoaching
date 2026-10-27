'use client';

import React, { useState } from 'react';
import {
  Trophy,
  Lock,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { SessionResultEntity } from '@/contracts';

interface SkillTreeSectionProps {
  sessionResults?: SessionResultEntity[];
}

interface SkillNode {
  id: string;
  name: string;
  branch: 'push' | 'pull' | 'core';
  level: number;
  requiredXP: number;
  description: string;
  targetCriteria: string;
  unlockedByDefault?: boolean;
}

const SKILL_NODES: SkillNode[] = [
  // Nhánh Đẩy (Pushing)
  {
    id: 'push-1',
    name: 'Chống đẩy tựa dốc (Incline Push-up)',
    branch: 'push',
    level: 1,
    requiredXP: 0,
    description: 'Xây dựng sức mạnh nền tảng cho cơ ngực và khớp vai.',
    targetCriteria: '15 lần liên tục giữ thân thẳng',
    unlockedByDefault: true,
  },
  {
    id: 'push-2',
    name: 'Chống đẩy tiêu chuẩn (Standard Push-up)',
    branch: 'push',
    level: 2,
    requiredXP: 100,
    description: 'Động tác cốt lõi của calisthenics, siết cơ bụng và mông.',
    targetCriteria: '10–12 lần ngực chạm sàn có kiểm soát',
  },
  {
    id: 'push-3',
    name: 'Chống đẩy kim cương (Diamond Push-up)',
    branch: 'push',
    level: 3,
    requiredXP: 250,
    description: 'Dồn trọng tâm vào cơ tay sau (triceps) và khớp khuỷu.',
    targetCriteria: '8–10 lần hai bàn tay chụm hình thoi',
  },
  {
    id: 'push-4',
    name: 'Archer Push-up (Chống đẩy cung thủ)',
    branch: 'push',
    level: 4,
    requiredXP: 450,
    description: 'Chuyển trọng lượng sang 1 tay, bước đệm lên One Arm Push-up.',
    targetCriteria: '6 lần mỗi bên trơn tru',
  },
  {
    id: 'push-5',
    name: 'Chống đẩy trồng chuối (Handstand Push-up)',
    branch: 'push',
    level: 5,
    requiredXP: 750,
    description: 'Đỉnh cao sức mạnh vai và khả năng giữ thăng bằng cơ thể.',
    targetCriteria: '5 lần chống đẩy dựa tường hoặc tự do',
  },

  // Nhánh Kéo (Pulling)
  {
    id: 'pull-1',
    name: 'Treo mình tĩnh trên xà (Dead Hang)',
    branch: 'pull',
    level: 1,
    requiredXP: 0,
    description: 'Tăng cường lực nắm cổ tay và giải nén đốt sống lưng.',
    targetCriteria: '30–45 giây treo xà thụ động',
    unlockedByDefault: true,
  },
  {
    id: 'pull-2',
    name: 'Kéo xà ngang (Inverted Row)',
    branch: 'pull',
    level: 2,
    requiredXP: 100,
    description: 'Kích hoạt cơ xô lưng và bắp tay trước góc nghiêng 45 độ.',
    targetCriteria: '10 lần ngực chạm thanh xà thấp',
  },
  {
    id: 'pull-3',
    name: 'Hít xà đơn chuẩn (Standard Pull-up)',
    branch: 'pull',
    level: 3,
    requiredXP: 250,
    description: 'Vua của các bài tập thân trên thể trọng, cằm vượt xà hoàn toàn.',
    targetCriteria: '6–8 lần cằm qua xà, không đung đưa đà (kipping)',
  },
  {
    id: 'pull-4',
    name: 'Hít xà ngực chạm xà (Chest to Bar)',
    branch: 'pull',
    level: 4,
    requiredXP: 450,
    description: 'Sức mạnh kéo bùng nổ, kéo cơ thể vượt hẳn tầm mắt.',
    targetCriteria: '5 lần phần xương ức chạm thanh xà',
  },
  {
    id: 'pull-5',
    name: 'Lên xà một nhịp (Muscle-up)',
    branch: 'pull',
    level: 5,
    requiredXP: 800,
    description: 'Biểu tượng calisthenics: Kết hợp kéo bùng nổ và đẩy đè xà.',
    targetCriteria: '3 lần chuyển vị thế mượt mà 2 tay đều nhau',
  },

  // Nhánh Core & Thân dưới
  {
    id: 'core-1',
    name: 'Squat thể trọng & Plank 45s',
    branch: 'core',
    level: 1,
    requiredXP: 0,
    description: 'Độ ổn định thân dưới và kích hoạt chuỗi cơ trọng tâm.',
    targetCriteria: '20 lần squat sâu + 45s plank chuẩn',
    unlockedByDefault: true,
  },
  {
    id: 'core-2',
    name: 'Co gối xà đơn (Hanging Knee Raise)',
    branch: 'core',
    level: 2,
    requiredXP: 120,
    description: 'Kiểm soát xương chậu và cơ gập hông khi treo xà.',
    targetCriteria: '12 lần co gối chạm ngực không đong đưa',
  },
  {
    id: 'core-3',
    name: 'L-Sit trên sàn hoặc xà kép',
    branch: 'core',
    level: 3,
    requiredXP: 300,
    description: 'Kháng lực cơ bụng và cơ đùi trước giữ thân hình chữ L.',
    targetCriteria: 'Giữ 15–20 giây chân thẳng song song mặt sàn',
  },
  {
    id: 'core-4',
    name: 'Dragon Flag (Lá cờ rồng Bruce Lee)',
    branch: 'core',
    level: 4,
    requiredXP: 600,
    description: 'Sức mạnh cơ lõi toàn thân chống lại trọng lực.',
    targetCriteria: '5 lần hạ người chậm và nâng thẳng thân người',
  },
];

export function SkillTreeSection({ sessionResults = [] }: SkillTreeSectionProps) {
  const [selectedBranch, setSelectedBranch] = useState<'push' | 'pull' | 'core'>('push');
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);

  // Mỗi buổi hoàn thành = 50 XP + 20 XP thưởng tân thủ
  const totalCompletedSessions = sessionResults.length;
  const userXP = totalCompletedSessions * 50 + 20;

  const getRank = (xp: number) => {
    if (xp < 100) return { title: 'Tân Thủ (Novice)', level: 1, next: 100, color: 'text-slate-300' };
    if (xp < 250) return { title: 'Tập Sự (Apprentice)', level: 2, next: 250, color: 'text-emerald-400' };
    if (xp < 500) return { title: 'Chiến Binh (Warrior)', level: 3, next: 500, color: 'text-blue-400' };
    if (xp < 800) return { title: 'Tinh Anh (Elite Athlete)', level: 4, next: 800, color: 'text-purple-400' };
    return { title: 'Bậc Thầy (Master of Calisthenics)', level: 5, next: 1200, color: 'text-amber-400' };
  };

  const rank = getRank(userXP);
  const currentBranchNodes = SKILL_NODES.filter((n) => n.branch === selectedBranch);

  return (
    <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 shadow-xl space-y-5">
      {/* 1. Header Rank & Level Profile */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 rounded-2xl border border-indigo-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-400/10">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-amber-300 uppercase tracking-widest font-extrabold flex items-center gap-1">
              <Zap className="w-3 h-3 fill-amber-300" />
              <span>Cây Kỹ Năng RPG Calisthenics</span>
            </span>
            <h3 className={`text-base font-black ${rank.color}`}>{rank.title}</h3>
            <p className="text-[11px] text-slate-400">
              Điểm rèn luyện: <span className="font-mono text-amber-300 font-bold">{userXP} XP</span> (từ {totalCompletedSessions} buổi hoàn thành)
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block">Cấp bậc</span>
          <span className="text-xl font-black font-mono text-white">LV.{rank.level}</span>
        </div>
      </div>

      {/* 2. Thanh kinh nghiệm XP Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Tiến độ thăng hạng tiếp theo</span>
          <span className="font-mono text-amber-300">
            {userXP} / {rank.next} XP
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (userXP / rank.next) * 100)}%` }}
          />
        </div>
      </div>

      {/* 3. Nhánh Kỹ Năng Tabs */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-white/5 text-xs font-bold">
        <button
          onClick={() => setSelectedBranch('push')}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            selectedBranch === 'push'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>💪 Nhánh Đẩy</span>
        </button>
        <button
          onClick={() => setSelectedBranch('pull')}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            selectedBranch === 'pull'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🧗 Nhánh Kéo</span>
        </button>
        <button
          onClick={() => setSelectedBranch('core')}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            selectedBranch === 'core'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🔥 Core & Chân</span>
        </button>
      </div>

      {/* 4. Sơ đồ các Node kỹ năng */}
      <div className="space-y-3 relative pl-6 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-amber-400 before:via-emerald-400 before:to-slate-700">
        {currentBranchNodes.map((node) => {
          const isUnlocked = node.unlockedByDefault || userXP >= node.requiredXP;

          return (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isUnlocked
                  ? 'bg-slate-800/80 hover:bg-slate-800 border-emerald-500/40 shadow-md shadow-emerald-500/5'
                  : 'bg-slate-950/60 border-slate-800/60 opacity-60 hover:opacity-80'
              }`}
            >
              {/* Icon chỉ điểm node */}
              <div
                className={`absolute -left-6 top-4 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ring-4 ring-slate-900 ${
                  isUnlocked
                    ? 'bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-400/50'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {isUnlocked ? <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" /> : <Lock className="w-3 h-3" />}
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                      Cấp {node.level}
                    </span>
                    <h4 className="font-bold text-sm text-white">{node.name}</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {node.description}
                  </p>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isUnlocked
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isUnlocked ? 'ĐÃ MỞ ✨' : `Khóa (${node.requiredXP} XP)`}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <span>🎯 Tiêu chuẩn: {node.targetCriteria}</span>
                <span className="text-amber-300 font-semibold flex items-center gap-0.5">
                  <span>Chi tiết</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Chi Tiết Kỹ Năng */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                <span>Chi Tiết Kỹ Năng Cấp {selectedNode.level}</span>
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-white">{selectedNode.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedNode.description}
              </p>

              <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">
                  Yêu Cầu Chinh Phục:
                </span>
                <p className="text-xs font-semibold text-emerald-300">
                  {selectedNode.targetCriteria}
                </p>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                <span>Điểm yêu cầu mở khóa:</span>
                <span className="font-bold text-amber-300">{selectedNode.requiredXP} XP</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedNode(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
            >
              Đã hiểu, tiếp tục rèn luyện
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
