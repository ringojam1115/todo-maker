"use client";

import { useMemo, useState } from "react";
import type {
  AppLanguage,
  DailyFeedback,
  DailyPlan,
  DailyPlansStore,
  Goal,
  LearningProfile,
  Task,
  TaskFeedback,
} from "@/types";
import { UI_TEXT } from "@/lib/settings";
import { loadFeedbacks, loadProfiles, saveFeedbacks, saveProfiles } from "@/lib/storage";

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
  language: AppLanguage;
  onTabSelect: (date: string) => void;
  onTabClose: (date: string) => void;
  onToggleTask: (goalId: string, date: string, taskId: string) => void;
  onTaskMetaChange: (
    goalId: string,
    date: string,
    taskId: string,
    patch: Pick<Task, "reflection" | "artifact">
  ) => void;
  onFeedbackSubmit: (updatedPlans: DailyPlansStore) => void;
  llmPayload: () => { provider: string; apiKey?: string; language: AppLanguage };
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

export default function CenterPanel({
  goals,
  plans,
  activeDate,
  selectedDate,
  language,
  onTabSelect,
  onTabClose,
  onToggleTask,
  onTaskMetaChange,
  onFeedbackSubmit,
  llmPayload,
}: CenterPanelProps) {
  const t = UI_TEXT[language];
  const today = new Date().toISOString().split("T")[0];
  const tabs = useMemo(() => {
    const base: Array<{ date: string; label: string }> = [{ date: today, label: t.today }];
    if (selectedDate && selectedDate !== today) base.push({ date: selectedDate, label: tabLabel(selectedDate, language) });
    return base;
  }, [language, selectedDate, t.today, today]);

  const items = useMemo(() => buildItems(goals, plans, activeDate), [goals, plans, activeDate]);
  const completed = items.filter((item) => item.task.completed).length;
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

      for (const [goalId, goalItems] of byGoal) {
        const goal = goalItems[0].goal;
        const plan = goalItems[0].plan;
        const taskFeedbacks: TaskFeedback[] = goalItems.map(({ task }) => ({
          taskId: task.id,
          taskText: task.text,
          completed: task.completed,
          completionRate: task.completed ? 100 : 0,
          actualMinutes: task.estimatedMinutes || 30,
          estimatedMinutes: task.estimatedMinutes || 30,
          difficulty: "just_right",
          materialName: goal.materials?.[0]?.name,
          reflection: task.reflection,
          artifact: task.artifact,
        }));

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

        const res = await fetch("/api/submit-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal,
            date: activeDate,
            taskFeedbacks,
            overallNote: goalItems
              .map(({ task }) => [task.reflection, task.artifact].filter(Boolean).join(" / "))
              .filter(Boolean)
              .join("\n"),
            energyLevel: "medium",
            remainingDays,
            currentPlans,
            profile: currentProfile,
            otherGoals,
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
            overallNote: plan.note ?? "",
            energyLevel: "medium",
            createdAt: new Date().toISOString(),
          });
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
    <main className="flex min-w-0 flex-1 flex-col bg-[var(--panel-strong)]">
      <div className="flex h-12 items-center border-b border-[var(--border)] bg-[var(--panel)] px-6">
        {tabs.map((tab) => {
          const active = tab.date === activeDate;
          return (
            <button
              key={tab.date}
              onClick={() => onTabSelect(tab.date)}
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 py-7">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">{tabLabel(activeDate, language)}</h1>
              <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(activeDate, language)}</p>
              {items.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {goals
                    .filter((goal) => items.some((item) => item.goal.id === goal.id))
                    .map((goal, index) => (
                      <span key={goal.id} className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] text-[var(--muted)]">
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: index % 2 === 0 ? "var(--accent)" : "var(--accent-2)" }} />
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
                {items.map(({ goal, task }, index) => {
                  const key = `${goal.id}_${activeDate}_${task.id}`;
                  const detailOpen = openDetails[key] ?? activeDate === today;
                  const color = index % 2 === 0 ? "var(--accent)" : "var(--accent-2)";
                  return (
                    <article key={key} className="border-b border-[var(--border)] pb-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => onToggleTask(goal.id, activeDate, task.id)}
                          className="mt-0.5 grid h-4 w-4 place-items-center rounded border"
                          style={{
                            borderColor: task.completed ? color : "var(--border-strong)",
                            background: task.completed ? color : "#fff",
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
                            <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted-2)]">
                              {task.estimatedMinutes > 0 && <span>{task.estimatedMinutes}分</span>}
                              {activeDate === today && (
                                <button
                                  onClick={() => setOpenDetails((prev) => ({ ...prev, [key]: !detailOpen }))}
                                  className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)]"
                                >
                                  {t.detail}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--muted)]">{goal.title}</p>
                          {activeDate === today && detailOpen && (
                            <div className="mt-3 flex flex-col gap-3">
                              {task.detail && (
                                <div className="rounded-md bg-[var(--panel)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
                                  {task.detail}
                                </div>
                              )}
                              <div className="grid gap-3 md:grid-cols-2">
                                <textarea
                                  value={task.reflection ?? ""}
                                  onChange={(e) => onTaskMetaChange(goal.id, activeDate, task.id, { reflection: e.target.value, artifact: task.artifact })}
                                  placeholder={t.memoPlaceholder}
                                  rows={3}
                                  className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                                />
                                <textarea
                                  value={task.artifact ?? ""}
                                  onChange={(e) => onTaskMetaChange(goal.id, activeDate, task.id, { reflection: task.reflection, artifact: e.target.value })}
                                  placeholder={t.artifactPlaceholder}
                                  rows={3}
                                  className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>

              {activeDate === today && (
                <section className="mt-4 flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">{t.feedback}</p>
                  <button
                    onClick={submitFeedback}
                    disabled={submitting}
                    className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {submitting ? (language === "ja" ? "送信中..." : "Submitting...") : t.submitFeedback}
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg bg-[var(--text)] px-5 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
