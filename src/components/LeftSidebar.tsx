"use client";

import { useState } from "react";
import Link from "next/link";
import type { Goal, DailyPlansStore } from "@/types";

interface LeftSidebarProps {
  goals: Goal[];
  selectedGoalId: string | null;
  plans: DailyPlansStore;
  onSelectGoal: (goalId: string) => void;
  onAddGoal: () => void;
  onEditGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  calendarConnected: boolean;
  onConnectCalendar: () => void;
}

function getProgress(goal: Goal, plans: DailyPlansStore): number {
  const start = goal.createdAt.split("T")[0];
  const deadline = goal.deadline;

  let total = 0;
  let done = 0;

  const d = new Date(start);
  const end = new Date(deadline);
  while (d <= end) {
    const key = `${goal.id}_${d.toISOString().split("T")[0]}`;
    const plan = plans[key];
    if (plan?.tasks?.length) {
      total += plan.tasks.length;
      done += plan.tasks.filter((t) => t.completed).length;
    }
    d.setDate(d.getDate() + 1);
  }

  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function daysLeft(deadline: string): number {
  const d = new Date(deadline + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function LeftSidebar({
  goals,
  selectedGoalId,
  plans,
  onSelectGoal,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  calendarConnected,
  onConnectCalendar,
}: LeftSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 240,
        minWidth: 240,
        background: "#f2f2ef",
        borderRight: "1px solid #e0e0da",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid #e0e0da" }}
      >
        <span className="font-bold text-sm tracking-wide" style={{ color: "#1a1a1a" }}>
          PLN
        </span>
        <button
          onClick={onAddGoal}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-base font-medium transition-opacity hover:opacity-80"
          style={{ background: "#5c9e2e" }}
          title="新しいゴールを追加"
        >
          +
        </button>
      </div>

      {/* Goal list */}
      <div className="flex-1 overflow-y-auto py-2 flex flex-col">
        {goals.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: "#aaa" }}>
              ゴールがありません
            </p>
            <p className="text-xs mt-1" style={{ color: "#aaa" }}>
              + で追加してください
            </p>
          </div>
        ) : (
          goals.map((goal) => {
            const progress = getProgress(goal, plans);
            const isSelected = goal.id === selectedGoalId;
            const remaining = daysLeft(goal.deadline);
            const isOverdue = remaining < 0;
            const isUrgent = remaining >= 0 && remaining <= 3;

            return (
              <div
                key={goal.id}
                className="relative"
                onMouseEnter={() => setHoveredId(goal.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  onClick={() => onSelectGoal(goal.id)}
                  className="w-full text-left px-4 py-3 flex flex-col gap-1.5 transition-colors"
                  style={{
                    background: isSelected ? "rgba(92,158,46,0.08)" : "transparent",
                    borderLeft: isSelected ? "2px solid #5c9e2e" : "2px solid transparent",
                  }}
                >
                  <div className="flex items-start justify-between gap-1 pr-10">
                    <span
                      className="text-xs font-semibold leading-snug"
                      style={{ color: "#1a1a1a" }}
                    >
                      {goal.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{
                        color: isOverdue ? "#e53e3e" : isUrgent ? "#e07b00" : "#888",
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      {isOverdue
                        ? `${Math.abs(remaining)}日超過`
                        : `${formatDeadline(goal.deadline)}まで`}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "#5c9e2e" }}>
                      {progress}%
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 3, background: "#e0e0da" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: "#5c9e2e" }}
                    />
                  </div>
                </button>

                {/* Edit / Delete buttons (show on hover) */}
                {hoveredId === goal.id && (
                  <div className="absolute top-2 right-2 flex gap-0.5 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditGoal(goal.id);
                      }}
                      title="編集"
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
                      style={{ color: "#888" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGoal(goal.id);
                      }}
                      title="削除"
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                      style={{ color: "#e53e3e" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 flex flex-col gap-2 flex-shrink-0"
        style={{ borderTop: "1px solid #e0e0da" }}
      >
        {/* Google Calendar */}
        <button
          onClick={onConnectCalendar}
          className="flex items-center gap-2 text-xs hover:opacity-70 transition-opacity text-left"
          style={{ color: calendarConnected ? "#5c9e2e" : "#888" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {calendarConnected ? "カレンダー連携済み ✓" : "Googleカレンダーを連携"}
        </button>

        {/* Profile */}
        <Link
          href={selectedGoalId ? `/profile?goalId=${selectedGoalId}` : "/profile"}
          className="flex items-center gap-2 text-xs hover:opacity-70 transition-opacity"
          style={{ color: "#888" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </svg>
          学習プロフィール
        </Link>
      </div>
    </aside>
  );
}
