"use client";

import { useMemo, useState } from "react";
import type {
  AppLanguage,
  DailyFeedback,
  DailyPlan,
  DailyPlansStore,
  Difficulty,
  Goal,
  LearningProfile,
  Task,
  TaskFeedback,
} from "@/types";
import { UI_TEXT } from "@/lib/settings";
import { loadFeedbacks, loadProfiles, saveFeedbacks, saveProfiles } from "@/lib/storage";

const GOAL_COLORS = ["var(--accent)", "var(--accent-2)", "#c47a1e", "#9e3e8a", "#c44a4a"];
function goalColor(goals: Goal[], goalId: string): string {
  const idx = goals.findIndex((g) => g.id === goalId);
  return GOAL_COLORS[(idx < 0 ? 0 : idx) % GOAL_COLORS.length];
}

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
    patch: Partial<Pick<Task, "reflection" | "artifact" | "actualMinutes" | "difficulty">>
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
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const dailyNote = dailyNotes[activeDate] ?? "";

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
          actualMinutes: task.actualMinutes ?? task.estimatedMinutes ?? 30,
          estimatedMinutes: task.estimatedMinutes || 30,
          difficulty: task.difficulty ?? "just_right",
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
            overallNote: dailyNote,
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
            overallNote: dailyNote,
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
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: goalColor(goals, goal.id) }} />
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
                  const detailOpen = openDetails[key] ?? false;
                  const details = detailLines(task);
                  const color = goalColor(goals, goal.id);
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
                            <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted-2)]">
                              {task.estimatedMinutes > 0 && <span>{task.estimatedMinutes}分</span>}
                              {activeDate === today && (
                                <button
                                  onClick={() => setOpenDetails((prev) => ({ ...prev, [key]: !detailOpen }))}
                                  className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)]"
                                >
                                  {t.detail} {detailOpen ? "⌃" : "⌄"}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--muted)]">{goal.title}</p>
                          {activeDate === today && detailOpen && (
                            <div className="mt-3 rounded-md bg-[var(--panel)] px-4 py-3">
                              {details.length > 0 ? (
                                <ul className="flex flex-col gap-2">
                                  {details.map((line) => (
                                    <li key={line} className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
                                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
                                      <span>{line}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-[var(--muted)]">
                                  {language === "ja"
                                    ? "このTODOの詳細はまだありません。"
                                    : "No details have been generated for this TODO yet."}
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
                <section className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-6">
                  <div className="mb-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">{t.feedback}</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {items.map(({ goal, task }) => {
                      const color = goalColor(goals, goal.id);
                      return (
                        <div key={`${goal.id}_${task.id}_feedback`} className="rounded-lg border border-[var(--border)] bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-relaxed text-[var(--text)]">{task.text}</p>
                              <p className="mt-1 text-[11px] font-semibold" style={{ color }}>
                                {goal.title}
                              </p>
                            </div>
                            </div>
                            {task.completed && (
                              <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                                {language === "ja" ? "完了" : "Done"}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                            <span>{language === "ja" ? "時間" : "Time"}</span>
                            <label className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={480}
                                value={task.actualMinutes ?? task.estimatedMinutes ?? 30}
                                onChange={(e) => onTaskMetaChange(goal.id, activeDate, task.id, { actualMinutes: Number(e.target.value) })}
                                className="h-6 w-12 rounded border border-[var(--border)] bg-[var(--panel)] px-2 text-center text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                              />
                              <span>{language === "ja" ? "分" : "min"}</span>
                            </label>

                            <span className="ml-1">{language === "ja" ? "難易度" : "Difficulty"}</span>
                            <div className="flex gap-1">
                              {difficultyOptions.map((option) => {
                                const selected = (task.difficulty ?? "just_right") === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    onClick={() => onTaskMetaChange(goal.id, activeDate, task.id, { difficulty: option.value })}
                                    className="rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
                                    style={{
                                      background: selected ? "var(--panel)" : "#fff",
                                      borderColor: selected ? "var(--border-strong)" : "var(--border)",
                                      color: selected ? "var(--text)" : "var(--muted)",
                                    }}
                                  >
                                    {language === "ja" ? option.labelJa : option.labelEn}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <textarea
                            value={task.reflection ?? ""}
                            onChange={(e) => onTaskMetaChange(goal.id, activeDate, task.id, { reflection: e.target.value })}
                            placeholder={
                              language === "ja"
                                ? "気づき、詰まった点、成果などを記録..."
                                : "Notes, blockers, artifacts..."
                            }
                            rows={3}
                            className="mt-3 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-2)] focus:border-[var(--accent)]"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-[var(--border)] bg-white px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--muted-2)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-[var(--text)]">
                          {language === "ja" ? "今日学んだこと" : "What you learned today"}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          {language === "ja"
                            ? "追加でやったこと・今日の学びを記録（次回のTODO更新に反映されます）"
                            : "Extra work done & today's learnings — used for next TODO update"}
                        </p>
                      </div>
                    </div>
                    <textarea
                      value={dailyNote}
                      onChange={(e) => setDailyNotes((prev) => ({ ...prev, [activeDate]: e.target.value }))}
                      placeholder={language === "ja" ? "今日の学び、次回に活かしたいことを記録..." : "What did you learn today?"}
                      rows={3}
                      className="mt-3 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-2)] focus:border-[var(--accent)]"
                    />
                  </div>

                  <button
                    onClick={submitFeedback}
                    disabled={submitting}
                    className="mt-2 self-center rounded-full border border-[#cbdcbc] bg-[#f2f7ee] px-3 py-1.5 text-[11px] font-medium text-[#5f8f3b] transition-colors hover:border-[#b8d0a4] hover:bg-[#edf5e7] disabled:opacity-40"
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
