"use client";

import { useMemo, useState } from "react";
import type {
  AppLanguage,
  DailyFeedback,
  DailyPlan,
  DailyPlansStore,
  Difficulty,
  EnergyLevel,
  Goal,
  LearningLog,
  LearningProfile,
  Observation,
  Reflection,
  Task,
  TaskFeedback,
} from "@/types";
import { UI_TEXT } from "@/lib/settings";
import { loadFeedbacks, loadProfiles, saveFeedbacks, saveProfiles, loadReflections, saveReflections, loadLearningLogs, saveLearningLogs } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";


interface DayTask {
  goal: Goal;
  plan: DailyPlan;
  task: Task;
}

interface CenterPanelProps {
  goals: Goal[];
  plans: DailyPlansStore;
  activeDate: string;
  selectedDate: string | null;
  weekRange?: { start: string; end: string } | null;
  language: AppLanguage;
  observations: Observation[];
  onTabSelect: (date: string, weekEnd?: string) => void;
  onTabClose: (date: string) => void;
  onToggleTask: (goalId: string, date: string, taskId: string) => void;
  onTaskMetaChange: (
    goalId: string,
    date: string,
    taskId: string,
    patch: Partial<Pick<Task, "reflection" | "artifact" | "actualMinutes" | "difficulty">>
  ) => void;
  onFeedbackSubmit: (updatedPlans: DailyPlansStore) => void;
  onObservationsUpdate: (observations: Observation[]) => void;
  onWeeklyReview: () => void;
  llmPayload: () => { provider: string; apiKey?: string; language: AppLanguage };
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

function formatDate(date: string, language: AppLanguage): string {
  const locale = language === "ja" ? "ja-JP" : "en-US";
  return new Date(date + "T00:00:00").toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function tabLabel(date: string, language: AppLanguage): string {
  const today = new Date().toISOString().split("T")[0];
  if (date === today) return UI_TEXT[language].today;
  return new Date(date + "T00:00:00").toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildItems(goals: Goal[], plans: DailyPlansStore, date: string): DayTask[] {
  return goals.flatMap((goal) => {
    const plan = plans[`${goal.id}_${date}`];
    if (!plan) return [];
    return plan.tasks.map((task) => ({ goal, plan, task }));
  });
}

function groupByGoal(items: DayTask[]) {
  const map = new Map<string, DayTask[]>();
  for (const item of items) {
    map.set(item.goal.id, [...(map.get(item.goal.id) ?? []), item]);
  }
  return [...map.entries()];
}

const difficultyOptions: Array<{ value: Difficulty; labelJa: string; labelEn: string }> = [
  { value: "easy", labelJa: "簡単", labelEn: "Easy" },
  { value: "just_right", labelJa: "普通", labelEn: "Good" },
  { value: "hard", labelJa: "難しい", labelEn: "Hard" },
];

function detailLines(task: Task): string[] {
  if (!task.detail) return [];
  const raw = task.detail
    .split(/\n|・|•|-/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = raw.length > 1 ? raw : [task.detail.trim()];
  return lines.filter((line) => line !== task.text);
}

function EnergyBadge({ level, language }: { level?: EnergyLevel; language: AppLanguage }) {
  if (!level) return null;
  const config = {
    deep: { labelJa: "集中", labelEn: "Deep", bg: "#ede9fe", color: "#7c3aed", border: "#c4b5fd" },
    medium: { labelJa: "通常", labelEn: "Medium", bg: "#f0f7e8", color: "#5c9e2e", border: "#c3e0a0" },
    light: { labelJa: "軽め", labelEn: "Light", bg: "#fff8e8", color: "#b45309", border: "#fde68a" },
  };
  const c = config[level];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {language === "ja" ? c.labelJa : c.labelEn}
    </span>
  );
}

function WeekSummaryView({
  goals,
  plans,
  weekRange,
  language,
}: {
  goals: Goal[];
  plans: DailyPlansStore;
  weekRange: { start: string; end: string };
  language: AppLanguage;
}) {
  // Collect plans per goal, sorted by date, within the week range
  const goalWeekData = goals.map((goal) => {
    const goalPlans = Object.entries(plans)
      .filter(([k, v]) => k.startsWith(`${goal.id}_`) && v.date >= weekRange.start && v.date <= weekRange.end)
      .map(([, v]) => v)
      .sort((a, b) => a.date.localeCompare(b.date));
    return { goal, goalPlans };
  }).filter((d) => d.goalPlans.length > 0);

  const totalTasks = goalWeekData.reduce((s, d) => s + d.goalPlans.reduce((ps, p) => ps + p.tasks.length, 0), 0);
  const totalMins = goalWeekData.reduce(
    (s, d) => s + d.goalPlans.reduce((ps, p) => ps + p.tasks.reduce((ts, t) => ts + t.estimatedMinutes, 0), 0),
    0
  );

  const s = new Date(weekRange.start + "T00:00:00");
  const e = new Date(weekRange.end + "T00:00:00");
  const locale = language === "ja" ? "ja-JP" : "en-US";
  const rangeLabel = `${s.toLocaleDateString(locale, { month: "numeric", day: "numeric" })} 〜 ${e.toLocaleDateString(locale, { month: "numeric", day: "numeric" })}`;

  if (goalWeekData.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <p className="text-xs text-[var(--muted)]">{rangeLabel}</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">{language === "ja" ? "週の概要" : "Week Overview"}</h1>
        </header>
        <p className="text-sm text-[var(--muted)]">{language === "ja" ? "この週のTODOはありません" : "No TODOs for this week"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header>
        <p className="text-xs text-[var(--muted)]">{rangeLabel}</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">{language === "ja" ? "週の概要" : "Week Overview"}</h1>
        <div className="mt-3 flex flex-wrap gap-3">
          <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] text-[var(--muted)]">
            {language === "ja" ? `${totalTasks}件のタスク` : `${totalTasks} tasks`}
          </span>
          <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] text-[var(--muted)]">
            {language === "ja" ? `約${Math.round(totalMins / 60)}時間` : `~${Math.round(totalMins / 60)}h`}
          </span>
          {goalWeekData.map(({ goal }) => (
            <span key={goal.id} className="flex items-center gap-1.5 rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: goal.color }} />
              {goal.title}
            </span>
          ))}
        </div>
      </header>

      {/* Section 1: 週初めの状態 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-2)]">
          {language === "ja" ? "週初めの状態" : "Week start"}
        </h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-5 py-4 flex flex-col gap-3">
          {goalWeekData.map(({ goal, goalPlans }) => {
            const firstPlan = goalPlans[0];
            const firstDayTasks = firstPlan.tasks.slice(0, 2);
            return (
              <div key={goal.id} className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: goal.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text)]">{goal.title}</p>
                  {firstPlan.focus && (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{firstPlan.focus}</p>
                  )}
                  {firstDayTasks.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {firstDayTasks.map((t) => (
                        <li key={t.id} className="text-[11px] text-[var(--muted-2)] leading-relaxed">• {t.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: この週にやること */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-2)]">
          {language === "ja" ? "この週にやること" : "This week's plan"}
        </h2>
        <div className="flex flex-col gap-4">
          {goalWeekData.map(({ goal, goalPlans }) => {
            const allTasks = goalPlans.flatMap((p) => p.tasks);
            const focusSet = [...new Set(goalPlans.map((p) => p.focus).filter(Boolean))];
            return (
              <div key={goal.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: goal.color }} />
                  <p className="text-xs font-semibold text-[var(--text)]">{goal.title}</p>
                  <span className="ml-auto text-[10px] text-[var(--muted-2)]">
                    {allTasks.length}{language === "ja" ? "件" : " tasks"} · {Math.round(allTasks.reduce((s, t) => s + t.estimatedMinutes, 0) / 60 * 10) / 10}h
                  </span>
                </div>
                {focusSet.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {focusSet.map((f) => (
                      <span key={f} className="rounded-full bg-white px-2.5 py-0.5 text-[10px] text-[var(--muted)] border border-[var(--border)]">{f}</span>
                    ))}
                  </div>
                )}
                <ul className="flex flex-col gap-1.5">
                  {allTasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--muted-2)]" />
                      <span className="text-xs text-[var(--text)] leading-relaxed">{t.text}</span>
                      {t.estimatedMinutes > 0 && (
                        <span className="ml-auto flex-shrink-0 text-[10px] text-[var(--muted-2)]">{formatMinutes(t.estimatedMinutes)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: 週末の理想の姿 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-2)]">
          {language === "ja" ? "週末の理想の姿" : "End of week goal"}
        </h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-5 py-4 flex flex-col gap-3">
          {goalWeekData.map(({ goal, goalPlans }) => {
            const lastPlan = goalPlans[goalPlans.length - 1];
            const lastTasks = lastPlan.tasks.slice(-2);
            return (
              <div key={goal.id} className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: goal.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text)]">{goal.title}</p>
                  {lastPlan.focus && (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{lastPlan.focus}</p>
                  )}
                  {lastTasks.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {lastTasks.map((t) => (
                        <li key={t.id} className="text-[11px] text-[var(--muted-2)] leading-relaxed">• {t.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function CenterPanel({
  goals,
  plans,
  activeDate,
  selectedDate,
  weekRange,
  language,
  observations,
  onTabSelect,
  onTabClose,
  onToggleTask,
  onTaskMetaChange,
  onFeedbackSubmit,
  onObservationsUpdate,
  onWeeklyReview,
  llmPayload,
}: CenterPanelProps) {
  const t = UI_TEXT[language];
  const today = new Date().toISOString().split("T")[0];
  const tabs = useMemo(() => {
    const base: Array<{ date: string; label: string; weekEnd?: string }> = [{ date: today, label: t.today }];
    if (weekRange) {
      const s = new Date(weekRange.start + "T00:00:00");
      const e = new Date(weekRange.end + "T00:00:00");
      const label = `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()}`;
      base.push({ date: weekRange.start, label, weekEnd: weekRange.end });
    } else if (selectedDate && selectedDate !== today) {
      base.push({ date: selectedDate, label: tabLabel(selectedDate, language) });
    }
    return base;
  }, [language, selectedDate, weekRange, t.today, today]);

  const items = useMemo(() => buildItems(goals, plans, activeDate), [goals, plans, activeDate]);
  const completed = items.filter((item) => item.task.completed).length;
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [openReasons, setOpenReasons] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const dailyNote = dailyNotes[activeDate] ?? "";

  // Per-task memo: freeText + mood
  const [taskMemos, setTaskMemos] = useState<Record<string, { freeText: string; mood: string }>>({});
  // Which task memo page is open (key = `${goalId}_${date}_${taskId}`)
  const [openMemoKey, setOpenMemoKey] = useState<string | null>(null);

  function getTaskMemo(key: string) {
    return taskMemos[key] ?? { freeText: "", mood: "" };
  }

  function updateTaskMemo(key: string, field: "freeText" | "mood", value: string) {
    setTaskMemos((prev) => ({ ...prev, [key]: { ...getTaskMemo(key), [field]: value } }));
  }

  async function submitFeedback() {
    const byGoal = groupByGoal(items);
    if (byGoal.length === 0) return;
    setSubmitting(true);
    setToast(null);

    try {
      const updatedStore: DailyPlansStore = {};
      const existingFeedbacks = loadFeedbacks();
      const profiles = loadProfiles();
      const nextFeedbacks: DailyFeedback[] = [...existingFeedbacks];
      let coachComment = "";

      // Collect structured reflections
      const allReflections = loadReflections();
      const newReflections: Reflection[] = [];

      for (const [goalId, goalItems] of byGoal) {
        const goal = goalItems[0].goal;
        const taskFeedbacks: TaskFeedback[] = goalItems.map(({ task }) => ({
          taskId: task.id,
          taskText: task.text,
          completed: task.completed,
          completionRate: task.completed ? 100 : 0,
          actualMinutes: task.actualMinutes ?? task.estimatedMinutes ?? 30,
          estimatedMinutes: task.estimatedMinutes || 30,
          difficulty: task.difficulty ?? "just_right",
          materialName: goal.materials?.[0]?.name,
          reflection: task.reflection,
          artifact: task.artifact,
        }));

        // Save task memos as reflections
        for (const { task } of goalItems) {
          const key = `${goal.id}_${activeDate}_${task.id}`;
          const memo = taskMemos[key];
          if (memo?.freeText) {
            newReflections.push({
              id: uuidv4(),
              task_id: task.id,
              goal_id: goalId,
              date: activeDate,
              what_i_did: memo.freeText,
              what_i_learned: "",
              what_blocked_me: "",
              mood: memo.mood,
              next_action: "",
              free_memo: memo.freeText,
              created_at: new Date().toISOString(),
            });
          }
        }

        const deadlineDate = new Date(goal.deadline + "T00:00:00");
        const currentD = new Date(activeDate + "T00:00:00");
        const remainingDays = Math.max(0, Math.ceil((deadlineDate.getTime() - currentD.getTime()) / (1000 * 60 * 60 * 24)));
        const currentPlans: DailyPlan[] = [];
        const d = new Date(activeDate + "T00:00:00");
        d.setDate(d.getDate() + 1);
        while (d <= deadlineDate) {
          const dateStr = d.toISOString().split("T")[0];
          const future = plans[`${goal.id}_${dateStr}`];
          if (future) currentPlans.push(future);
          d.setDate(d.getDate() + 1);
        }

        const currentProfile: LearningProfile = profiles[goalId] || {
          goalId,
          averageCompletionRate: 0,
          averageTimeRatio: 1,
          materialAffinities: [],
          difficultyTrend: "stable",
          totalStudyMinutes: 0,
          updatedAt: new Date().toISOString(),
        };

        const otherGoals = goals
          .filter((g) => g.id !== goalId)
          .map((g) => ({
            title: g.title,
            dailyMinutes: g.dailyMinutes ?? 60,
            remainingDays: Math.max(
              0,
              Math.ceil((new Date(g.deadline + "T00:00:00").getTime() - currentD.getTime()) / (1000 * 60 * 60 * 24))
            ),
          }));

        const goalReflections = allReflections
          .filter((r) => r.goal_id === goalId)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map((r) => ({
            date: r.date,
            what_i_learned: r.free_memo ?? r.what_i_learned,
            what_blocked_me: r.what_blocked_me,
            mood: r.mood,
            next_action: r.next_action,
          }));

        const res = await fetch("/api/submit-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal,
            date: activeDate,
            taskFeedbacks,
            overallNote: dailyNote,
            energyLevel: "medium",
            remainingDays,
            currentPlans,
            profile: currentProfile,
            otherGoals,
            recentReflections: goalReflections.length > 0 ? goalReflections : undefined,
            llm: llmPayload(),
          }),
        });

        if (!res.ok) throw new Error(language === "ja" ? "送信に失敗しました" : "Submit failed");
        const data = await res.json();
        coachComment = data.coachComment ?? coachComment;
        profiles[goalId] = data.updatedProfile;

        for (const dayPlan of data.updatedPlans as Array<{ date: string; focus: string; tasks: Task[] }>) {
          const key = `${goalId}_${dayPlan.date}`;
          updatedStore[key] = {
            date: dayPlan.date,
            focus: dayPlan.focus,
            tasks: dayPlan.tasks.map((task) => ({ ...task, completed: false })),
            note: plans[key]?.note ?? "",
          };
        }

        if (!nextFeedbacks.some((f) => f.goalId === goalId && f.date === activeDate)) {
          nextFeedbacks.push({
            date: activeDate,
            goalId,
            taskFeedbacks,
            overallNote: dailyNote,
            energyLevel: "medium",
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Save reflections
      if (newReflections.length > 0) {
        saveReflections([...allReflections, ...newReflections]);

        // Generate observations from reflections
        const firstGoalId = byGoal[0]?.[0];
        const firstGoal = goals.find((g) => g.id === firstGoalId);
        if (firstGoal) {
          try {
            const obsRes = await fetch("/api/generate-observations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reflections: newReflections,
                existingObservations: observations,
                goalTitle: firstGoal.title,
                llm: llmPayload(),
              }),
            });
            if (obsRes.ok) {
              const obsData = await obsRes.json();
              onObservationsUpdate(obsData.observations ?? []);
            }
          } catch {
            // Observation generation is non-critical
          }
        }
      }

      // Auto-save today's learning note as LearningLog if provided
      if (dailyNote.trim()) {
        const logs = loadLearningLogs();
        const firstGoalId = byGoal[0]?.[0];
        const alreadyLogged = logs.some((l) => l.date === activeDate && l.content === dailyNote.trim());
        if (!alreadyLogged) {
          saveLearningLogs([...logs, {
            id: uuidv4(),
            date: activeDate,
            content: dailyNote.trim(),
            related_goal_id: firstGoalId ?? "",
            created_at: new Date().toISOString(),
          }]);
        }
      }

      saveFeedbacks(nextFeedbacks);
      saveProfiles(profiles);
      onFeedbackSubmit(updatedStore);
      setToast(coachComment || (language === "ja" ? "更新しました" : "Updated"));
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : language === "ja" ? "エラーが発生しました" : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--panel-strong)]">
      <div className="flex h-12 items-center border-b border-[var(--border)] bg-[var(--panel)] px-6">
        {tabs.map((tab) => {
          const active = tab.date === activeDate;
          return (
            <button
              key={tab.date}
              onClick={() => onTabSelect(tab.date, tab.weekEnd)}
              className="mr-7 flex h-12 items-center gap-2 border-b-2 text-xs font-medium"
              style={{
                borderColor: active ? "var(--accent)" : "transparent",
                color: active ? "var(--text)" : "var(--muted)",
              }}
            >
              {tab.label}
              {tab.date !== today && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.date);
                  }}
                  className="text-[var(--muted-2)]"
                >
                  x
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onWeeklyReview}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
          >
            {language === "ja" ? "週次レビュー" : "Weekly Review"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 py-7">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {weekRange ? (
            <WeekSummaryView goals={goals} plans={plans} weekRange={weekRange} language={language} />
          ) : (<><header className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">{tabLabel(activeDate, language)}</h1>
              <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(activeDate, language)}</p>
              {items.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {goals
                    .filter((goal) => items.some((item) => item.goal.id === goal.id))
                    .map((goal) => (
                      <span key={goal.id} className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] text-[var(--muted)]">
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: goal.color }} />
                        {goal.title}
                      </span>
                    ))}
                </div>
              )}
            </div>
            <div className="rounded-full bg-[var(--panel)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">
              <span className="text-[var(--accent)]">{completed}</span> / {items.length}
            </div>
          </header>

          {items.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
              {goals.length === 0 ? t.selectGoal : t.noTodos}
            </div>
          ) : (
            <>
              <section className="flex flex-col gap-3">
                {items.map(({ goal, task }) => {
                  const key = `${goal.id}_${activeDate}_${task.id}`;
                  const detailOpen = openDetails[key] ?? false;
                  const reasonOpen = openReasons[key] ?? false;
                  const details = detailLines(task);
                  const color = goal.color;
                  return (
                    <article key={key} className="border-b border-[var(--border)] pb-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => onToggleTask(goal.id, activeDate, task.id)}
                          disabled={activeDate !== today}
                          className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded border"
                          style={{
                            borderColor: task.completed ? color : "var(--border-strong)",
                            background: task.completed ? color : "#fff",
                            opacity: activeDate !== today ? 0.4 : 1,
                            cursor: activeDate !== today ? "default" : "pointer",
                          }}
                        >
                          {task.completed && <span className="text-[10px] text-white">✓</span>}
                        </button>
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <p className={`text-sm leading-relaxed ${task.completed ? "text-[var(--muted-2)] line-through" : "text-[var(--text)]"}`}>
                              {task.text}
                            </p>
                            <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted-2)]">
                              <EnergyBadge level={task.energy_level} language={language} />
                              {task.estimatedMinutes > 0 && <span>{formatMinutes(task.estimatedMinutes)}</span>}
                              {activeDate === today && (
                                <button
                                  onClick={() => setOpenMemoKey(key)}
                                  className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-colors"
                                >
                                  {language === "ja" ? "メモ" : "Memo"}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--muted)]">{goal.title}</p>

                          {/* TODO reason */}
                          {task.reason && (
                            <div className="mt-1">
                              <button
                                onClick={() => setOpenReasons((prev) => ({ ...prev, [key]: !reasonOpen }))}
                                className="text-[10px] text-[var(--muted-2)] hover:text-[var(--muted)] transition-colors"
                              >
                                {language === "ja" ? "理由を見る" : "Why this?"} {reasonOpen ? "⌃" : "⌄"}
                              </button>
                              {reasonOpen && (
                                <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)] rounded bg-[var(--panel)] px-3 py-2">
                                  {task.reason}
                                </p>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>

              {activeDate !== today && (
                <p className="mt-4 rounded-md bg-[var(--panel)] px-4 py-3 text-[11px] text-[var(--muted)]">
                  {language === "ja"
                    ? "追加でやったことは「今日」の振り返り欄に記録できます。TODO再生成の参考に使われます。"
                    : "Extra work can be noted in today's reflection section and used for TODO regeneration."}
                </p>
              )}

              {activeDate === today && (
                <section className="mt-6 border-t border-[var(--border)] pt-6">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">
                    {language === "ja" ? "今日の振り返り" : "Today's reflection"}
                  </p>
                  <p className="mb-4 text-[11px] text-[var(--muted)]">
                    {language === "ja"
                      ? "一日を振り返って、思ったことを自由に書いてください。"
                      : "Reflect on your day — write freely."}
                  </p>
                  <textarea
                    value={dailyNote}
                    onChange={(e) => {
                      setDailyNotes((prev) => ({ ...prev, [activeDate]: e.target.value }));
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }}
                    placeholder={language === "ja"
                      ? "例）今日は論文の目的と新規性について整理した。..."
                      : "e.g. Today I organized the purpose and novelty of my paper..."}
                    style={{ minHeight: "200px" }}
                    className="w-full resize-none rounded-xl border border-[var(--border)] bg-white px-5 py-4 text-sm leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted-2)] focus:border-[var(--border-strong)]"
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={submitFeedback}
                      disabled={submitting}
                      className="rounded-full border border-[#cbdcbc] bg-[#f2f7ee] px-4 py-1.5 text-[11px] font-medium text-[#5f8f3b] transition-colors hover:border-[#b8d0a4] hover:bg-[#edf5e7] disabled:opacity-40"
                    >
                      {submitting ? (language === "ja" ? "送信中..." : "Submitting...") : t.submitFeedback}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </>)}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg bg-[var(--text)] px-5 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Task memo overlay */}
      {openMemoKey && (() => {
        const memoItem = items.find(
          ({ goal, task }) => `${goal.id}_${activeDate}_${task.id}` === openMemoKey
        );
        if (!memoItem) return null;
        const { goal, task } = memoItem;
        const memo = getTaskMemo(openMemoKey);
        const actualMins = task.actualMinutes ?? task.estimatedMinutes ?? 30;
        const memoHours = Math.floor(actualMins / 60);
        const memoMinutes = actualMins % 60;
        return (
          <div className="absolute inset-0 z-30 flex flex-col bg-white overflow-y-auto">
            {/* Header */}
            <div className="flex h-12 items-center border-b border-[var(--border)] px-6">
              <button
                onClick={() => setOpenMemoKey(null)}
                className="flex items-center gap-2 text-[13px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              >
                <span>←</span>
                <span>{language === "ja" ? "メモ" : "Memo"}</span>
              </button>
            </div>

            {/* Content */}
            <div className="mx-auto w-full max-w-2xl flex-1 px-10 py-8 flex flex-col gap-6">
              {/* Task title */}
              <div>
                <h2 className="text-xl font-bold leading-snug text-[var(--text)]">{task.text}</h2>
                <p className="mt-1.5 text-[12px] font-medium" style={{ color: goal.color }}>{goal.title}</p>
              </div>

              {/* Metrics row */}
              <div className="flex flex-wrap items-start gap-8">
                {/* Time */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[var(--muted)]">
                    {language === "ja" ? "実際にかかった時間" : "Time spent"}
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={memoHours}
                      onChange={(e) => {
                        const h = Number(e.target.value);
                        onTaskMetaChange(goal.id, activeDate, task.id, { actualMinutes: h * 60 + memoMinutes });
                      }}
                      className="h-8 w-10 rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 text-center text-sm text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
                    />
                    <span className="text-sm text-[var(--muted)]">:</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={memoMinutes}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        onTaskMetaChange(goal.id, activeDate, task.id, { actualMinutes: memoHours * 60 + m });
                      }}
                      className="h-8 w-10 rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 text-center text-sm text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
                    />
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[var(--muted)]">
                    {language === "ja" ? "難易度" : "Difficulty"}
                  </p>
                  <div className="flex items-center gap-1">
                    {difficultyOptions.map((option, i) => {
                      const selected = (task.difficulty ?? "just_right") === option.value;
                      const isFirst = i === 0;
                      const isLast = i === difficultyOptions.length - 1;
                      return (
                        <button
                          key={option.value}
                          onClick={() => onTaskMetaChange(goal.id, activeDate, task.id, { difficulty: option.value })}
                          className="border px-3 py-1.5 text-[11px] font-medium transition-colors"
                          style={{
                            borderRadius: isFirst ? "6px 0 0 6px" : isLast ? "0 6px 6px 0" : "0",
                            marginLeft: isFirst ? 0 : -1,
                            background: selected ? "var(--text)" : "#fff",
                            borderColor: selected ? "var(--text)" : "var(--border)",
                            color: selected ? "#fff" : "var(--muted)",
                            position: "relative",
                            zIndex: selected ? 1 : 0,
                          }}
                        >
                          {language === "ja" ? option.labelJa : option.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mood */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[var(--muted)]">
                    {language === "ja" ? "気分" : "Mood"}
                  </p>
                  <div className="flex gap-1.5">
                    {(["😫", "😐", "😊", "😄"] as const).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => updateTaskMemo(openMemoKey, "mood", memo.mood === emoji ? "" : emoji)}
                        className="h-9 w-9 flex items-center justify-center rounded-full border text-lg transition-all"
                        style={{
                          borderColor: memo.mood === emoji ? "var(--border-strong)" : "var(--border)",
                          background: memo.mood === emoji ? "var(--panel)" : "#fff",
                          transform: memo.mood === emoji ? "scale(1.15)" : "scale(1)",
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Free memo */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-[var(--muted)]">
                    {language === "ja" ? "フリーメモ" : "Notes"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">
                    {language === "ja"
                      ? "やったこと、学んだこと、つながったこと、次にやりたいことなど、思ったままに書いてください。"
                      : "Write freely — what you did, learned, connected, or want to do next."}
                  </p>
                </div>
                <textarea
                  value={memo.freeText}
                  onChange={(e) => {
                    updateTaskMemo(openMemoKey, "freeText", e.target.value);
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }}
                  placeholder={language === "ja"
                    ? `例）今日は論文の目的と新規性について整理した。...`
                    : "e.g. Today I organized the purpose and novelty of the paper..."}
                  style={{ minHeight: "380px" }}
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--panel)] px-5 py-4 text-sm leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted-2)] focus:border-[var(--border-strong)]"
                />
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
