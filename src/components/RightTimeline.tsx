"use client";

import type { AppLanguage, DailyPlansStore, Goal } from "@/types";
import { UI_TEXT } from "@/lib/settings";

interface RightTimelineProps {
  goals: Goal[];
  plans: DailyPlansStore;
  activeDate: string;
  language: AppLanguage;
  onSelectDate: (date: string) => void;
}

function uniqueDates(plans: DailyPlansStore): string[] {
  return [...new Set(Object.values(plans).map((plan) => plan.date))].sort((a, b) => a.localeCompare(b));
}

function itemsForDate(goals: Goal[], plans: DailyPlansStore, date: string) {
  return goals.flatMap((goal) => {
    const plan = plans[`${goal.id}_${date}`];
    return plan ? [{ goal, plan }] : [];
  });
}

function formatDate(date: string, language: AppLanguage): string {
  return new Date(date + "T00:00:00").toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function rangeLabel(date: string, language: AppLanguage): string {
  const d = new Date(date + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const locale = language === "ja" ? "ja-JP" : "en-US";
  return `${d.toLocaleDateString(locale, { month: "numeric", day: "numeric" })}-${end.toLocaleDateString(locale, { month: "numeric", day: "numeric" })}`;
}

export default function RightTimeline({ goals, plans, activeDate, language, onSelectDate }: RightTimelineProps) {
  const t = UI_TEXT[language];
  const today = new Date().toISOString().split("T")[0];
  const dates = uniqueDates(plans);
  const nextSeven = dates.filter((date) => date <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const later = dates.filter((date) => !nextSeven.includes(date));

  return (
    <aside className="hidden h-full w-[220px] min-w-[220px] flex-col border-l border-[var(--border)] bg-[var(--panel)] lg:flex">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-2)]">{t.timeline}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {dates.length === 0 ? (
          <p className="px-1 py-6 text-xs text-[var(--muted)]">{language === "ja" ? "TODOがありません" : "No TODOs yet"}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-1">
              {nextSeven.map((date) => {
                const entries = itemsForDate(goals, plans, date);
                const total = entries.reduce((sum, entry) => sum + entry.plan.tasks.length, 0);
                const done = entries.reduce((sum, entry) => sum + entry.plan.tasks.filter((task) => task.completed).length, 0);
                const active = date === activeDate;
                return (
                  <button
                    key={date}
                    onClick={() => onSelectDate(date)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-white"
                    style={{ background: active ? "#fff" : "transparent" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: date === today ? "var(--accent)" : "var(--muted-2)" }} />
                    <span className="min-w-0 flex-1 text-xs font-medium text-[var(--text)]">{date === today ? t.today : formatDate(date, language)}</span>
                    <span className="text-[10px] text-[var(--muted)]">{done}/{total}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {later.map((date) => {
                const entries = itemsForDate(goals, plans, date);
                const total = entries.reduce((sum, entry) => sum + entry.plan.tasks.length, 0);
                const done = entries.reduce((sum, entry) => sum + entry.plan.tasks.filter((task) => task.completed).length, 0);
                const active = date === activeDate;
                return (
                  <button
                    key={date}
                    onClick={() => onSelectDate(date)}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-left"
                    style={{ boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none" }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text)]">{rangeLabel(date, language)}</span>
                      <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{total}</span>
                    </div>
                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--panel)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: total === 0 ? "0%" : `${Math.round((done / total) * 100)}%` }} />
                    </div>
                    <div className="flex gap-1">
                      {entries.slice(0, 6).map((entry, index) => (
                        <span
                          key={entry.goal.id}
                          className="h-1.5 flex-1 rounded-full"
                          style={{ background: index % 2 === 0 ? "var(--accent)" : "var(--accent-2)", opacity: 0.55 }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
