"use client";

import type { AppLanguage, DailyPlansStore, Goal, Task } from "@/types";
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

interface GoalRangeEntry {
  goal: Goal;
  tasks: Task[];
  focus: string;
}

function addDays(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDay(date: string, language: AppLanguage): string {
  return new Date(date + "T00:00:00").toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function rangeLabel(start: string, end: string, language: AppLanguage): string {
  const locale = language === "ja" ? "ja-JP" : "en-US";
  const s = new Date(start + "T00:00:00").toLocaleDateString(locale, { month: "numeric", day: "numeric" });
  const e = new Date(end + "T00:00:00").toLocaleDateString(locale, { month: "numeric", day: "numeric" });
  return `${s}-${e}`;
}

function monthLabel(ym: string, language: AppLanguage): string {
  const [y, m] = ym.split("-").map(Number);
  if (language === "ja") return `${y}年${m}月`;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

// Collect all plans for each goal that fall within [start, end]
function getEntriesForRange(goals: Goal[], plans: DailyPlansStore, start: string, end: string): GoalRangeEntry[] {
  return goals.flatMap((goal) => {
    const matched = Object.entries(plans)
      .filter(([k, v]) => k.startsWith(`${goal.id}_`) && v.date >= start && v.date <= end)
      .map(([, v]) => v);
    if (matched.length === 0) return [];
    return [{
      goal,
      tasks: matched.flatMap((p) => p.tasks),
      focus: matched.find((p) => p.focus)?.focus ?? "",
    }];
  });
}

// Get plans for a specific single date (for daily rows)
function getDailyEntries(goals: Goal[], plans: DailyPlansStore, date: string) {
  return goals.flatMap((goal) => {
    const plan = plans[`${goal.id}_${date}`];
    return plan ? [{ goal, plan }] : [];
  });
}

function PeriodCard({
  rangeStart,
  label,
  entries,
  active,
  language,
  onSelectDate,
  variant,
}: {
  rangeStart: string;
  label: string;
  entries: GoalRangeEntry[];
  active: boolean;
  language: AppLanguage;
  onSelectDate: (d: string) => void;
  variant: "weekly" | "monthly";
}) {
  const maxMins = Math.max(...entries.map((e) => e.tasks.reduce((s, t) => s + t.estimatedMinutes, 0)), 1);
  const unitLabel = language === "ja" ? "件" : "";

  // Collect focus texts per goal
  const focusItems = entries.filter((e) => e.focus);

  return (
    <button
      onClick={() => onSelectDate(rangeStart)}
      className="w-full rounded-lg border bg-white px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)]"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        boxShadow: active ? "0 0 0 1px var(--accent)" : "none",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--text)]">{label}</span>
        {focusItems.length > 0 && (
          <span
            className="max-w-[90px] shrink-0 truncate rounded-full px-2 py-0.5 text-[9px] font-medium leading-tight"
            style={
              variant === "weekly"
                ? { background: "var(--accent-soft)", color: "var(--accent)" }
                : { background: "var(--panel)", border: "1px solid var(--border)", color: "var(--muted)" }
            }
            title={focusItems.map((e) => e.focus).join(" / ")}
          >
            {focusItems[0].focus}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const mins = entry.tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
          const count = entry.tasks.length;
          const barWidth = Math.round((mins / maxMins) * 100);
          return (
            <div key={entry.goal.id} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: entry.goal.color }} />
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--panel)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${barWidth}%`, background: entry.goal.color, opacity: variant === "weekly" ? 0.65 : 0.4 }}
                />
              </div>
              <span className="w-8 text-right text-[10px] text-[var(--muted)]">{count}{unitLabel}</span>
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

  // --- Daily: today to today+7 ---
  const dailyDates = Array.from({ length: 8 }, (_, i) => addDays(today, i)).filter((date) =>
    goals.some((g) => plans[`${g.id}_${date}`])
  );

  // --- Weekly: 3 fixed buckets starting at today+8 ---
  const weekBuckets = Array.from({ length: 3 }, (_, i) => ({
    start: addDays(today, 8 + i * 7),
    end: addDays(today, 14 + i * 7),
  }));

  // --- Monthly: calendar months that contain any plan date >= today+29 ---
  const monthlyStart = addDays(today, 29);
  const monthSet = new Set<string>();
  for (const [k, v] of Object.entries(plans)) {
    if (goals.some((g) => k.startsWith(`${g.id}_`)) && v.date >= monthlyStart) {
      monthSet.add(v.date.slice(0, 7)); // "YYYY-MM"
    }
  }
  const monthBuckets = [...monthSet].sort().map((ym) => {
    const [y, m] = ym.split("-").map(Number);
    const start = `${ym}-01`;
    const end = new Date(y, m, 0).toISOString().split("T")[0];
    return { ym, start, end };
  });

  const hasTodos = dailyDates.length > 0 || weekBuckets.some((b) => getEntriesForRange(goals, plans, b.start, b.end).length > 0) || monthBuckets.length > 0;

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
          {goals.map((goal) => (
            <div key={goal.id} className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: goal.color }} />
              <span className="truncate text-[10px] text-[var(--muted)]">{goal.title}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
        {!hasTodos ? (
          <p className="px-1 py-4 text-xs text-[var(--muted)]">
            {language === "ja" ? "TODOがありません" : "No TODOs yet"}
          </p>
        ) : (
          <>
            {/* Daily rows */}
            {dailyDates.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {dailyDates.map((date) => {
                  const entries = getDailyEntries(goals, plans, date);
                  const total = entries.reduce((s, e) => s + e.plan.tasks.length, 0);
                  const done = entries.reduce((s, e) => s + e.plan.tasks.filter((t) => t.completed).length, 0);
                  const isToday = date === today;
                  return (
                    <button
                      key={date}
                      onClick={() => onSelectDate(date)}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-white"
                      style={{ background: date === activeDate ? "#fff" : "transparent" }}
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
                        {entries.map((e) => (
                          <span key={e.goal.id} className="h-1.5 w-1.5 rounded-full" style={{ background: e.goal.color }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Weekly buckets (3 fixed weeks) */}
            <div className="flex flex-col gap-2">
              {weekBuckets.map((bucket) => {
                const entries = getEntriesForRange(goals, plans, bucket.start, bucket.end);
                if (entries.length === 0) return null;
                const active = activeDate >= bucket.start && activeDate <= bucket.end;
                return (
                  <PeriodCard
                    key={bucket.start}
                    rangeStart={bucket.start}
                    label={rangeLabel(bucket.start, bucket.end, language)}
                    entries={entries}
                    active={active}
                    language={language}
                    onSelectDate={onSelectDate}
                    variant="weekly"
                  />
                );
              })}
            </div>

            {/* Monthly buckets */}
            {monthBuckets.length > 0 && (
              <div className="flex flex-col gap-2">
                {monthBuckets.map((bucket) => {
                  const entries = getEntriesForRange(goals, plans, bucket.start, bucket.end);
                  if (entries.length === 0) return null;
                  const active = activeDate >= bucket.start && activeDate <= bucket.end;
                  return (
                    <PeriodCard
                      key={bucket.ym}
                      rangeStart={bucket.start}
                      label={monthLabel(bucket.ym, language)}
                      entries={entries}
                      active={active}
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
