"use client";

import type { AppLanguage, DailyPlansStore, Goal } from "@/types";
import { UI_TEXT } from "@/lib/settings";

interface RightTimelineProps {
  goals: Goal[];
  plans: DailyPlansStore;
  activeDate: string;
  language: AppLanguage;
  width: number;
  onWidthChange: (width: number) => void;
  onSelectDate: (date: string) => void;
}

function uniqueDates(plans: DailyPlansStore): string[] {
  return [...new Set(Object.values(plans).map((p) => p.date))].sort((a, b) => a.localeCompare(b));
}


function formatDay(date: string, language: AppLanguage): string {
  return new Date(date + "T00:00:00").toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function weekRangeLabel(date: string, language: AppLanguage): string {
  const d = new Date(date + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const locale = language === "ja" ? "ja-JP" : "en-US";
  return `${d.toLocaleDateString(locale, { month: "numeric", day: "numeric" })}-${end.toLocaleDateString(locale, { month: "numeric", day: "numeric" })}`;
}

function monthLabel(date: string, language: AppLanguage): string {
  const d = new Date(date + "T00:00:00");
  if (language === "ja") return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function categorizeDate(date: string, today: string): "daily" | "weekly" | "monthly" {
  const diffDays = Math.ceil(
    (new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 7) return "daily";
  if (diffDays <= 90) return "weekly";
  return "monthly";
}

function getEntries(goals: Goal[], plans: DailyPlansStore, date: string) {
  return goals.flatMap((goal, index) => {
    const plan = plans[`${goal.id}_${date}`];
    return plan ? [{ goal, plan, color: goal.color }] : [];
  });
}

function PeriodCard({
  date,
  label,
  entries,
  active,
  focusText,
  language,
  onSelectDate,
  variant,
}: {
  date: string;
  label: string;
  entries: ReturnType<typeof getEntries>;
  active: boolean;
  focusText: string;
  language: AppLanguage;
  onSelectDate: (d: string) => void;
  variant: "weekly" | "monthly";
}) {
  const maxMins = Math.max(...entries.map((e) => e.plan.tasks.reduce((s, t) => s + t.estimatedMinutes, 0)), 1);
  const unitLabel = language === "ja" ? "件" : "";
  return (
    <button
      onClick={() => onSelectDate(date)}
      className="w-full rounded-lg border bg-white px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)]"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        boxShadow: active ? "0 0 0 1px var(--accent)" : "none",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--text)]">{label}</span>
        {focusText && (
          <span
            className="max-w-[90px] shrink-0 truncate rounded-full px-2 py-0.5 text-[9px] font-medium leading-tight"
            style={
              variant === "weekly"
                ? { background: "var(--accent-soft)", color: "var(--accent)" }
                : { background: "var(--panel)", border: "1px solid var(--border)", color: "var(--muted)" }
            }
          >
            {focusText}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const mins = entry.plan.tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
          const count = entry.plan.tasks.length;
          const barWidth = Math.round((mins / maxMins) * 100);
          return (
            <div key={entry.goal.id} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: entry.color }} />
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--panel)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${barWidth}%`, background: entry.color, opacity: variant === "weekly" ? 0.6 : 0.4 }}
                />
              </div>
              <span className="w-8 text-right text-[10px] text-[var(--muted)]">
                {count}{unitLabel}
              </span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

export default function RightTimeline({
  goals,
  plans,
  activeDate,
  language,
  width,
  onWidthChange,
  onSelectDate,
}: RightTimelineProps) {
  const t = UI_TEXT[language];
  const today = new Date().toISOString().split("T")[0];
  const dates = uniqueDates(plans);

  const dailyDates = dates.filter((d) => categorizeDate(d, today) === "daily");
  const weeklyDates = dates.filter((d) => categorizeDate(d, today) === "weekly");
  const monthlyDates = dates.filter((d) => categorizeDate(d, today) === "monthly");

  function startResize(e: React.MouseEvent<HTMLDivElement>) {
    const startX = e.clientX;
    const startWidth = width;
    function move(ev: MouseEvent) {
      onWidthChange(Math.min(360, Math.max(180, startWidth - (ev.clientX - startX))));
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
      className="relative hidden h-full flex-col border-l border-[var(--border)] bg-[var(--panel)] lg:flex"
      style={{ width, minWidth: width }}
    >
      <div
        onMouseDown={startResize}
        className="absolute left-[-3px] top-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)]"
      />

      <div className="border-b border-[var(--border)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-2)]">{t.timeline}</p>
      </div>

      {goals.length > 0 && (
        <div className="flex flex-col gap-1 border-b border-[var(--border)] px-4 py-2">
          {goals.map((goal, index) => (
            <div key={goal.id} className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: goal.color }} />
              <span className="truncate text-[10px] text-[var(--muted)]">{goal.title}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
        {dates.length === 0 ? (
          <p className="px-1 py-4 text-xs text-[var(--muted)]">
            {language === "ja" ? "TODOがありません" : "No TODOs yet"}
          </p>
        ) : (
          <>
            {dailyDates.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {dailyDates.map((date) => {
                  const entries = getEntries(goals, plans, date);
                  const total = entries.reduce((s, e) => s + e.plan.tasks.length, 0);
                  const done = entries.reduce((s, e) => s + e.plan.tasks.filter((t) => t.completed).length, 0);
                  const active = date === activeDate;
                  const isToday = date === today;
                  return (
                    <button
                      key={date}
                      onClick={() => onSelectDate(date)}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-white"
                      style={{ background: active ? "#fff" : "transparent" }}
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: isToday ? "var(--accent)" : "var(--muted-2)" }}
                      />
                      <span className="min-w-0 flex-1 text-xs font-medium text-[var(--text)]">
                        {isToday ? (language === "ja" ? "今日" : "Today") : formatDay(date, language)}
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">{done}/{total}</span>
                      <span className="flex gap-0.5">
                        {entries.map((entry) => (
                          <span
                            key={entry.goal.id}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: entry.color }}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {weeklyDates.length > 0 && (
              <div className="flex flex-col gap-2">
                {weeklyDates.map((date) => {
                  const entries = getEntries(goals, plans, date);
                  const focusText = entries.find((e) => e.plan.focus)?.plan.focus ?? "";
                  return (
                    <PeriodCard
                      key={date}
                      date={date}
                      label={weekRangeLabel(date, language)}
                      entries={entries}
                      active={date === activeDate}
                      focusText={focusText}
                      language={language}
                      onSelectDate={onSelectDate}
                      variant="weekly"
                    />
                  );
                })}
              </div>
            )}

            {monthlyDates.length > 0 && (
              <div className="flex flex-col gap-2">
                {monthlyDates.map((date) => {
                  const entries = getEntries(goals, plans, date);
                  const focusText = entries.find((e) => e.plan.focus)?.plan.focus ?? "";
                  return (
                    <PeriodCard
                      key={date}
                      date={date}
                      label={monthLabel(date, language)}
                      entries={entries}
                      active={date === activeDate}
                      focusText={focusText}
                      language={language}
                      onSelectDate={onSelectDate}
                      variant="monthly"
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
