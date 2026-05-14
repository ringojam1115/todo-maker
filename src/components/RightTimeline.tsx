"use client";

import type { Goal, DailyPlansStore } from "@/types";

interface RightTimelineProps {
  goal: Goal | null;
  plans: DailyPlansStore;
  activeDate: string;
  onSelectDate: (date: string) => void;
}

function getDates(goal: Goal): string[] {
  const dates: string[] = [];
  const d = new Date(goal.createdAt.split("T")[0] + "T00:00:00");
  const end = new Date(goal.deadline + "T00:00:00");
  while (d <= end) {
    dates.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function groupByWeek(dates: string[]): Array<{ label: string; dates: string[] }> {
  const weeks: Array<{ label: string; dates: string[] }> = [];
  let current: { label: string; dates: string[] } | null = null;

  for (const date of dates) {
    const d = new Date(date + "T00:00:00");
    const day = d.getDay();
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - day);
    const label = weekStart.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });

    if (!current || current.label !== label) {
      current = { label: `${label}の週`, dates: [] };
      weeks.push(current);
    }
    current.dates.push(date);
  }

  return weeks;
}

function formatDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}

export default function RightTimeline({
  goal,
  plans,
  activeDate,
  onSelectDate,
}: RightTimelineProps) {
  const today = new Date().toISOString().split("T")[0];

  if (!goal) {
    return (
      <aside
        className="flex flex-col h-full items-center justify-center"
        style={{ width: 200, minWidth: 200, borderLeft: "1px solid #e0e0da", background: "#f2f2ef" }}
      >
        <p className="text-xs" style={{ color: "#aaa" }}>
          ゴールを選択
        </p>
      </aside>
    );
  }

  const dates = getDates(goal);
  const weeks = groupByWeek(dates);

  return (
    <aside
      className="flex flex-col h-full overflow-hidden"
      style={{ width: 200, minWidth: 200, borderLeft: "1px solid #e0e0da", background: "#f2f2ef" }}
    >
      <div
        className="px-4 py-3 text-xs font-semibold"
        style={{ borderBottom: "1px solid #e0e0da", color: "#666" }}
      >
        タイムライン
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {weeks.map((week, i) => (
          <div key={i} className="mb-1">
            <div className="px-4 py-1.5 text-xs font-semibold" style={{ color: "#aaa" }}>
              {week.label}
            </div>
            {week.dates.map((date) => {
              const key = `${goal.id}_${date}`;
              const hasTasks = (plans[key]?.tasks?.length ?? 0) > 0;
              const isToday = date === today;
              const isActive = date === activeDate;

              return (
                <button
                  key={date}
                  onClick={() => onSelectDate(date)}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-black/5"
                  style={{
                    background: isActive ? "rgba(92,158,46,0.1)" : "transparent",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: hasTasks ? "#5c9e2e" : "#ccc" }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color: isToday ? "#5c9e2e" : isActive ? "#1a1a1a" : "#555",
                      fontWeight: isToday ? 700 : isActive ? 600 : 400,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                    }}
                  >
                    {formatDate(date)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
