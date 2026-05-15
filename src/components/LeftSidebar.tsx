"use client";

import Link from "next/link";
import type { AppLanguage, DailyPlansStore, Goal } from "@/types";
import { UI_TEXT } from "@/lib/settings";

interface Recommendation {
  name: string;
  reason: string;
}

interface LeftSidebarProps {
  goals: Goal[];
  selectedGoalId: string | null;
  plans: DailyPlansStore;
  width: number;
  language: AppLanguage;
  onWidthChange: (width: number) => void;
  onSelectGoal: (goalId: string) => void;
  onAddGoal: () => void;
  onEditGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onHideSidebar: () => void;
  onOpenSettings: () => void;
  tips?: string[];
  recommendations?: Recommendation[];
  tipsLoading?: boolean;
}

function getProgress(goal: Goal, plans: DailyPlansStore): number {
  let total = 0;
  let done = 0;
  for (const [key, plan] of Object.entries(plans)) {
    if (!key.startsWith(`${goal.id}_`)) continue;
    total += plan.tasks.length;
    done += plan.tasks.filter((task) => task.completed).length;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function formatDeadline(deadline: string, language: AppLanguage): string {
  return new Date(deadline + "T00:00:00").toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
  });
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
  width,
  language,
  onWidthChange,
  onSelectGoal,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onHideSidebar,
  onOpenSettings,
  tips = [],
  recommendations = [],
  tipsLoading = false,
}: LeftSidebarProps) {
  const t = UI_TEXT[language];

  function startResize(e: React.MouseEvent<HTMLDivElement>) {
    const startX = e.clientX;
    const startWidth = width;

    function move(ev: MouseEvent) {
      onWidthChange(Math.min(420, Math.max(220, startWidth + ev.clientX - startX)));
    }
    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <aside
      className="relative flex h-full flex-col border-r border-[var(--border)] bg-[var(--panel)]"
      style={{ width, minWidth: width }}
    >
      <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
        <button onClick={onHideSidebar} className="text-base font-bold lowercase text-[var(--text)]">pln.</button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSettings}
            className="grid h-7 w-7 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] hover:bg-white"
            title={t.settings}
          >
            ⚙
          </button>
          <button
            onClick={onAddGoal}
            className="grid h-7 w-7 place-items-center rounded-md border border-[var(--border)] bg-white text-sm text-[var(--text)] hover:border-[var(--border-strong)]"
            title={t.addGoal}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-4">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-2)]">
            {t.goals}
          </p>

          {goals.length === 0 ? (
            <button onClick={onAddGoal} className="rounded-md border border-dashed border-[var(--border)] px-3 py-5 text-xs text-[var(--muted)]">
              {t.addGoal}
            </button>
          ) : (
            goals.map((goal, index) => {
              const progress = getProgress(goal, plans);
              const remaining = daysLeft(goal.deadline);
              const isSelected = selectedGoalId === goal.id;
              const accent = index % 2 === 0 ? "var(--accent)" : "var(--accent-2)";

              return (
                <div
                  key={goal.id}
                  className="group relative rounded-md border border-transparent px-2 py-3 hover:border-[var(--border)] hover:bg-white"
                  style={{ borderLeft: isSelected ? `2px solid ${accent}` : "2px solid transparent" }}
                >
                  <button onClick={() => onSelectGoal(goal.id)} className="w-full text-left">
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 h-2 w-2 rounded-full" style={{ background: accent }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[var(--text)]">{goal.title}</p>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                          <span>{formatDeadline(goal.deadline, language)} {language === "ja" ? "まで" : ""}</span>
                          <span>{remaining >= 0 ? `${remaining}d` : `+${Math.abs(remaining)}d`}</span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: accent }} />
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                    <button
                      onClick={() => onEditGoal(goal.id)}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[var(--muted)] shadow-sm ring-1 ring-[var(--border)] hover:text-[var(--text)]"
                      title={language === "ja" ? "編集" : "Edit"}
                      aria-label={language === "ja" ? "編集" : "Edit"}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2.2 8.8l.35-1.9L7.65 1.8a1.12 1.12 0 0 1 1.58 0l.97.97a1.12 1.12 0 0 1 0 1.58L5.1 9.45l-1.9.35a.85.85 0 0 1-1-1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                        <path d="M6.9 2.6l2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteGoal(goal.id)}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-500 shadow-sm ring-1 ring-[var(--border)] hover:bg-red-50"
                      title={language === "ja" ? "削除" : "Delete"}
                      aria-label={language === "ja" ? "削除" : "Delete"}
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="max-h-[50%] overflow-y-auto border-t border-[var(--border)] px-2 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-2)]">
            {t.tips}
          </p>
          {tipsLoading ? (
            <p className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-xs text-[var(--muted)]">
              {language === "ja" ? "分析中..." : "Analyzing..."}
            </p>
          ) : tips.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[var(--muted-2)]">
              {language === "ja" ? "TODOを作ると表示されます" : "Tips appear after TODOs are created"}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tips.slice(0, 3).map((tip, index) => (
                <div key={tip} className="rounded-md border border-[var(--border)] bg-white px-3 py-2">
                  <div className="flex gap-2">
                    <span className="text-[10px] font-semibold text-[var(--accent)]">{index + 1}</span>
                    <p className="text-xs leading-relaxed text-[var(--text)]">{tip}</p>
                  </div>
                </div>
              ))}
              {recommendations.slice(0, 1).map((item) => (
                <div key={item.name} className="rounded-md border border-[var(--border)] bg-white px-3 py-2">
                  <p className="text-xs font-semibold text-[var(--text)]">{item.name}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{item.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3">
        <Link href={selectedGoalId ? `/profile?goalId=${selectedGoalId}` : "/profile"} className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
          {t.profile}
        </Link>
      </div>

      <div
        onMouseDown={startResize}
        className="absolute right-[-3px] top-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)]"
      />
    </aside>
  );
}
