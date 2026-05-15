"use client";

import Link from "next/link";
import type { Goal, DailyPlansStore } from "@/types";

interface LeftSidebarProps {
  goals: Goal[];
  selectedGoalId: string | null;
  plans: DailyPlansStore;
  onSelectGoal: (goalId: string) => void;
  onAddGoal: () => void;
}

function getProgress(goal: Goal, plans: DailyPlansStore): number {
  const today = new Date().toISOString().split("T")[0];
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

  void today;
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export default function LeftSidebar({
  goals,
  selectedGoalId,
  plans,
  onSelectGoal,
  onAddGoal,
}: LeftSidebarProps) {
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
        className="flex items-center justify-between px-4 py-4"
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
            return (
              <button
                key={goal.id}
                onClick={() => onSelectGoal(goal.id)}
                className="w-full text-left px-4 py-3 flex flex-col gap-1.5 transition-colors"
                style={{
                  background: isSelected ? "rgba(92,158,46,0.08)" : "transparent",
                  borderLeft: isSelected ? "2px solid #5c9e2e" : "2px solid transparent",
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className="text-xs font-semibold leading-snug"
                    style={{ color: "#1a1a1a" }}
                  >
                    {goal.title}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#888", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    {formatDeadline(goal.deadline)}まで
                  </span>
                  <span className="text-xs font-medium" style={{ color: "#5c9e2e" }}>
                    {progress}%
                  </span>
                </div>
                {/* Progress bar */}
                <div
                  className="rounded-full overflow-hidden"
                  style={{ height: 3, background: "#e0e0da" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, background: "#5c9e2e" }}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer: profile link */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid #e0e0da" }}
      >
        <Link
          href={selectedGoalId ? `/profile?goalId=${selectedGoalId}` : "/profile"}
          className="flex items-center gap-2 text-xs hover:opacity-70 transition-opacity"
          style={{ color: "#888" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
