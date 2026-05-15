"use client";

import { useState, useEffect } from "react";
import type { Goal, DailyPlan, DailyFeedback } from "@/types";

interface GoalDeleteModalProps {
  goal: Goal;
  plans: DailyPlan[];
  feedbacks: DailyFeedback[];
  onClose: () => void;
  onDelete: (skillMemo: string) => void;
}

export default function GoalDeleteModal({
  goal,
  plans,
  feedbacks,
  onClose,
  onDelete,
}: GoalDeleteModalProps) {
  const [extracting, setExtracting] = useState(false);
  const [skillMemo, setSkillMemo] = useState("");
  const [showSkill, setShowSkill] = useState(false);

  const allTasks = plans.flatMap((p) => p.tasks);
  const hasTasks = allTasks.length > 0;

  useEffect(() => {
    if (!hasTasks) return;
    setExtracting(true);
    fetch("/api/extract-skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, plans, feedbacks }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSkillMemo(data.skills ?? "");
        setShowSkill(true);
      })
      .catch(() => setShowSkill(true))
      .finally(() => setExtracting(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <div
        className="rounded-xl shadow-xl w-[480px] max-w-full mx-4 flex flex-col"
        style={{ background: "#fff", border: "1px solid #e0e0da", maxHeight: "85vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #e0e0da" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "#e53e3e" }}>
            ゴールを削除
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none rounded hover:bg-gray-100 w-7 h-7 flex items-center justify-center"
            style={{ color: "#888" }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: "#444" }}>
            <span className="font-semibold" style={{ color: "#1a1a1a" }}>
              「{goal.title}」
            </span>
            を削除します。この操作は取り消せません。
          </p>

          {hasTasks && (
            <>
              <div
                className="rounded-lg p-3 text-xs"
                style={{ background: "#f0f7e8", border: "1px solid #c3e0a0", color: "#444" }}
              >
                {allTasks.length}件のタスク記録が見つかりました。
                削除前に学習内容をスキルメモに保存できます。
              </div>

              {extracting && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "#888" }}>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  AIがスキルメモを作成しています...
                </div>
              )}

              {showSkill && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium" style={{ color: "#666" }}>
                    スキルメモ（編集可能・削除後もプロフィールに残ります）
                  </label>
                  <textarea
                    value={skillMemo}
                    onChange={(e) => setSkillMemo(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                    style={{
                      border: "1px solid #e0e0da",
                      background: "#f9f9f7",
                      fontFamily: "var(--font-manrope), sans-serif",
                      color: "#1a1a1a",
                    }}
                  />
                  <p className="text-xs" style={{ color: "#aaa" }}>
                    空欄にするとスキルメモは保存されません。
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid #e0e0da" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
          >
            キャンセル
          </button>
          <button
            onClick={() => onDelete(skillMemo)}
            disabled={extracting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: "#e53e3e" }}
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
