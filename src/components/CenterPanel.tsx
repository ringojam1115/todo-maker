"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  Goal,
  DailyPlan,
  DailyPlansStore,
  Task,
  TaskFeedback,
  LearningProfile,
} from "@/types";
import {
  loadFeedbacks,
  saveFeedbacks,
  loadProfiles,
  saveProfiles,
} from "@/lib/storage";

interface Tab {
  date: string;
  label: string;
}

interface CenterPanelProps {
  goal: Goal | null;
  plans: DailyPlansStore;
  openTabs: Tab[];
  activeDate: string;
  onTabSelect: (date: string) => void;
  onTabClose: (date: string) => void;
  onToggleTask: (date: string, taskId: string) => void;
  onNoteChange: (date: string, note: string) => void;
  onUpdateTodos: (date: string) => Promise<void>;
  updatingTodos: boolean;
  onFeedbackSubmit: (updatedPlans: DailyPlansStore) => void;
  allGoals?: Goal[];
}

function formatTabLabel(date: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (date === today) return "今日";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

type Difficulty = "easy" | "just_right" | "hard";
type EnergyLevel = "low" | "medium" | "high";

interface FeedbackInput {
  completionRate: number;
  actualMinutes: number;
  difficulty: Difficulty;
}

function DayView({
  date,
  plan,
  goal,
  plans,
  allGoals,
  onToggleTask,
  onNoteChange,
  onUpdateTodos,
  updatingTodos,
  onFeedbackSubmit,
}: {
  date: string;
  plan: DailyPlan | undefined;
  goal: Goal | null;
  plans: DailyPlansStore;
  allGoals: Goal[];
  onToggleTask: (taskId: string) => void;
  onNoteChange: (note: string) => void;
  onUpdateTodos: () => void;
  updatingTodos: boolean;
  onFeedbackSubmit: (updatedPlans: DailyPlansStore) => void;
}) {
  const [noteSaved, setNoteSaved] = useState(false);
  const [localNote, setLocalNote] = useState(plan?.note ?? "");

  // Feedback state
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, FeedbackInput>>({});
  const [feedbackNote, setFeedbackNote] = useState("");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("medium");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Initialize feedback inputs and check if already submitted
  useEffect(() => {
    if (!plan?.tasks || !goal) return;

    const initial: Record<string, FeedbackInput> = {};
    for (const task of plan.tasks) {
      initial[task.id] = {
        completionRate: task.completed ? 100 : 0,
        actualMinutes: task.estimatedMinutes || 30,
        difficulty: "just_right",
      };
    }
    setFeedbackInputs(initial);

    const feedbacks = loadFeedbacks();
    const alreadySubmitted = feedbacks.some(
      (f) => f.date === date && f.goalId === goal.id
    );
    setFeedbackSubmitted(alreadySubmitted);
  }, [plan, date, goal]);

  useEffect(() => {
    setLocalNote(plan?.note ?? "");
  }, [plan?.note]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleNoteBlur() {
    onNoteChange(localNote);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  function updateFeedback(taskId: string, field: keyof FeedbackInput, value: number | Difficulty) {
    setFeedbackInputs((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value },
    }));
  }

  async function handleSubmitFeedback() {
    if (!plan || !goal) return;
    setSubmittingFeedback(true);

    try {
      const taskFeedbacks: TaskFeedback[] = plan.tasks.map((task) => ({
        taskId: task.id,
        taskText: task.text,
        completed: task.completed,
        completionRate: feedbackInputs[task.id]?.completionRate ?? (task.completed ? 100 : 0),
        actualMinutes: feedbackInputs[task.id]?.actualMinutes ?? task.estimatedMinutes ?? 30,
        estimatedMinutes: task.estimatedMinutes ?? 30,
        difficulty: feedbackInputs[task.id]?.difficulty ?? "just_right",
        materialName: goal.materials?.[0]?.name,
      }));

      const deadlineDate = new Date(goal.deadline + "T00:00:00");
      const currentD = new Date(date + "T00:00:00");
      const remainingDays = Math.max(
        0,
        Math.ceil((deadlineDate.getTime() - currentD.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Collect future plans
      const currentPlans: DailyPlan[] = [];
      const d = new Date(date + "T00:00:00");
      d.setDate(d.getDate() + 1);
      while (d <= deadlineDate) {
        const dateStr = d.toISOString().split("T")[0];
        const key = `${goal.id}_${dateStr}`;
        if (plans[key]) currentPlans.push(plans[key]);
        d.setDate(d.getDate() + 1);
      }

      const profiles = loadProfiles();
      const currentProfile: LearningProfile = profiles[goal.id] || {
        goalId: goal.id,
        averageCompletionRate: 0,
        averageTimeRatio: 1,
        materialAffinities: [],
        difficultyTrend: "stable",
        totalStudyMinutes: 0,
        updatedAt: new Date().toISOString(),
      };

      const otherGoals = allGoals
        .filter((g) => g.id !== goal.id)
        .map((g) => {
          const dl = new Date(g.deadline + "T00:00:00");
          const now = new Date(date + "T00:00:00");
          return {
            title: g.title,
            dailyMinutes: g.dailyMinutes ?? 60,
            remainingDays: Math.max(0, Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
          };
        });

      const res = await fetch("/api/submit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          date,
          taskFeedbacks,
          overallNote: feedbackNote,
          energyLevel,
          remainingDays,
          currentPlans,
          profile: currentProfile,
          otherGoals,
        }),
      });

      if (!res.ok) throw new Error("送信に失敗しました");
      const data = await res.json();

      // Save feedback to localStorage
      const feedbacks = loadFeedbacks();
      saveFeedbacks([
        ...feedbacks,
        {
          date,
          goalId: goal.id,
          taskFeedbacks,
          overallNote: feedbackNote,
          energyLevel,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Save updated profile
      const updatedProfiles = loadProfiles();
      saveProfiles({ ...updatedProfiles, [goal.id]: data.updatedProfile });

      // Build updated plans store
      const updatedStore: DailyPlansStore = {};
      for (const dayPlan of data.updatedPlans as Array<{
        date: string;
        focus: string;
        tasks: Task[];
      }>) {
        const key = `${goal.id}_${dayPlan.date}`;
        updatedStore[key] = {
          date: dayPlan.date,
          focus: dayPlan.focus,
          tasks: dayPlan.tasks.map((t) => ({ ...t, completed: false })),
          note: plans[key]?.note ?? "",
        };
      }

      onFeedbackSubmit(updatedStore);
      setFeedbackSubmitted(true);
      setToast(data.coachComment);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (!plan || plan.tasks.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ color: "#aaa" }}
      >
        <p className="text-sm">この日のTODOはありません</p>
      </div>
    );
  }

  const completed = plan.tasks.filter((t) => t.completed).length;
  const total = plan.tasks.length;

  const difficultyOptions: { value: Difficulty; label: string }[] = [
    { value: "easy", label: "簡単" },
    { value: "just_right", label: "ちょうど" },
    { value: "hard", label: "難しい" },
  ];

  const energyOptions: { value: EnergyLevel; label: string }[] = [
    { value: "low", label: "低め" },
    { value: "medium", label: "普通" },
    { value: "high", label: "好調" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Focus */}
      {plan.focus && (
        <div
          className="px-6 py-3 text-xs font-medium flex-shrink-0"
          style={{ color: "#5c9e2e", borderBottom: "1px solid #e0e0da" }}
        >
          テーマ: {plan.focus}
        </div>
      )}

      {/* Progress */}
      <div
        className="px-6 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: "1px solid #e0e0da" }}
      >
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 4, background: "#e0e0da" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.round((completed / total) * 100)}%`,
              background: "#5c9e2e",
            }}
          />
        </div>
        <span
          className="text-xs font-medium"
          style={{
            color: "#5c9e2e",
            fontFamily: "var(--font-jetbrains-mono), monospace",
          }}
        >
          {completed}/{total}
        </span>
      </div>

      {/* Task list */}
      <div className="px-6 py-4 flex flex-col gap-2 flex-shrink-0">
        {plan.tasks.map((task) => (
          <label key={task.id} className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onToggleTask(task.id)}
                className="sr-only"
              />
              <div
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  border: task.completed ? "none" : "1.5px solid #ccc",
                  background: task.completed ? "#5c9e2e" : "transparent",
                }}
                onClick={() => onToggleTask(task.id)}
              >
                {task.completed && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4l3 3 5-6"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex-1">
              <span
                className="text-sm leading-snug"
                style={{
                  color: task.completed ? "#aaa" : "#1a1a1a",
                  textDecoration: task.completed ? "line-through" : "none",
                }}
              >
                {task.text}
              </span>
              {task.estimatedMinutes > 0 && (
                <span className="text-xs ml-2" style={{ color: "#bbb" }}>
                  {task.estimatedMinutes}分
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Note area */}
      <div
        className="px-6 py-4 flex flex-col gap-2 flex-shrink-0"
        style={{ borderTop: "1px solid #e0e0da" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "#666" }}>
            今日の記録
          </span>
          {noteSaved && (
            <span className="text-xs" style={{ color: "#5c9e2e" }}>
              保存済み ✓
            </span>
          )}
        </div>
        <textarea
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="今日の学習内容、気づきを記録..."
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
          style={{
            border: "1px solid #e0e0da",
            background: "#f9f9f7",
            fontFamily: "var(--font-manrope), sans-serif",
            color: "#1a1a1a",
          }}
        />
        <button
          onClick={onUpdateTodos}
          disabled={updatingTodos || !localNote.trim()}
          className="self-end px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: "#5c9e2e" }}
        >
          {updatingTodos && (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          )}
          {updatingTodos ? "更新中..." : "TODO更新"}
        </button>
      </div>

      {/* ── Feedback section ── */}
      <div
        className="px-6 py-4 flex flex-col gap-4"
        style={{ borderTop: "2px solid #e0e0da", background: feedbackSubmitted ? "#fafaf8" : "#fff" }}
      >
        <p className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>
          今日の振り返り
          {feedbackSubmitted && (
            <span className="ml-2 font-normal" style={{ color: "#5c9e2e" }}>
              ✓ 送信済み
            </span>
          )}
        </p>

        {/* Per-task feedback */}
        {plan.tasks.map((task) => {
          const fb = feedbackInputs[task.id] ?? {
            completionRate: 0,
            actualMinutes: 30,
            difficulty: "just_right" as Difficulty,
          };
          return (
            <div
              key={task.id}
              className="flex flex-col gap-2 pb-4"
              style={{ borderBottom: "1px solid #f0f0ea" }}
            >
              <p
                className="text-xs font-medium leading-snug"
                style={{ color: feedbackSubmitted ? "#aaa" : "#1a1a1a" }}
              >
                {task.completed ? "☑" : "☐"} {task.text}
                {task.estimatedMinutes > 0 && (
                  <span style={{ color: "#bbb" }}> （予定{task.estimatedMinutes}分）</span>
                )}
              </p>

              {/* Completion rate slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: "#888" }}>
                    達成度
                  </span>
                  <span className="text-xs font-medium" style={{ color: "#5c9e2e" }}>
                    {fb.completionRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={fb.completionRate}
                  disabled={feedbackSubmitted}
                  onChange={(e) =>
                    updateFeedback(task.id, "completionRate", Number(e.target.value))
                  }
                  className="w-full"
                  style={{ accentColor: "#5c9e2e" }}
                />
              </div>

              {/* Actual minutes */}
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "#888" }}>
                  実際にかかった時間:
                </span>
                <input
                  type="number"
                  min={0}
                  max={480}
                  value={fb.actualMinutes}
                  disabled={feedbackSubmitted}
                  onChange={(e) =>
                    updateFeedback(task.id, "actualMinutes", Number(e.target.value))
                  }
                  className="w-16 rounded px-2 py-0.5 text-xs outline-none text-center"
                  style={{
                    border: "1px solid #e0e0da",
                    background: feedbackSubmitted ? "#f5f5f2" : "#f9f9f7",
                    color: "#1a1a1a",
                  }}
                />
                <span className="text-xs" style={{ color: "#888" }}>分</span>
              </div>

              {/* Difficulty toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "#888" }}>
                  難易度:
                </span>
                <div className="flex gap-1">
                  {difficultyOptions.map((opt) => (
                    <button
                      key={opt.value}
                      disabled={feedbackSubmitted}
                      onClick={() => updateFeedback(task.id, "difficulty", opt.value)}
                      className="px-2.5 py-0.5 rounded text-xs font-medium transition-colors"
                      style={{
                        background: fb.difficulty === opt.value ? "#5c9e2e" : "#f0f0ec",
                        color: fb.difficulty === opt.value ? "#fff" : "#666",
                        border: "1px solid",
                        borderColor: fb.difficulty === opt.value ? "#5c9e2e" : "#e0e0da",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Overall note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "#666" }}>
            今日の気づき・メモ（任意）
          </label>
          <textarea
            value={feedbackNote}
            disabled={feedbackSubmitted}
            onChange={(e) => setFeedbackNote(e.target.value)}
            placeholder="学習の気づきや次回へのメモ..."
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
            style={{
              border: "1px solid #e0e0da",
              background: feedbackSubmitted ? "#f5f5f2" : "#f9f9f7",
              fontFamily: "var(--font-manrope), sans-serif",
              color: "#1a1a1a",
            }}
          />
        </div>

        {/* Energy level */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "#666" }}>
            今日のコンディション:
          </span>
          <div className="flex gap-1">
            {energyOptions.map((opt) => (
              <button
                key={opt.value}
                disabled={feedbackSubmitted}
                onClick={() => setEnergyLevel(opt.value)}
                className="px-2.5 py-0.5 rounded text-xs font-medium transition-colors"
                style={{
                  background: energyLevel === opt.value ? "#5c9e2e" : "#f0f0ec",
                  color: energyLevel === opt.value ? "#fff" : "#666",
                  border: "1px solid",
                  borderColor: energyLevel === opt.value ? "#5c9e2e" : "#e0e0da",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit button */}
        {!feedbackSubmitted && (
          <button
            onClick={handleSubmitFeedback}
            disabled={submittingFeedback}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            style={{ background: "#5c9e2e" }}
          >
            {submittingFeedback && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            )}
            {submittingFeedback
              ? "送信中..."
              : "フィードバックを送信して明日のTODOを更新する"}
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm text-white shadow-lg z-50 max-w-sm text-center"
          style={{ background: "#5c9e2e" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function CenterPanel({
  goal,
  plans,
  openTabs,
  activeDate,
  onTabSelect,
  onTabClose,
  onToggleTask,
  onNoteChange,
  onUpdateTodos,
  updatingTodos,
  onFeedbackSubmit,
  allGoals = [],
}: CenterPanelProps) {
  const handleUpdateTodos = useCallback(
    () => onUpdateTodos(activeDate),
    [onUpdateTodos, activeDate]
  );

  if (!goal) {
    return (
      <main
        className="flex-1 flex flex-col items-center justify-center h-full"
        style={{ background: "#fafaf8" }}
      >
        <div className="text-center" style={{ color: "#aaa" }}>
          <p className="text-2xl font-bold mb-2" style={{ color: "#5c9e2e" }}>
            PLN
          </p>
          <p className="text-sm">左のサイドバーからゴールを選択してください</p>
          <p className="text-sm mt-1">または「+」で新しいゴールを追加</p>
        </div>
      </main>
    );
  }

  const planKey = `${goal.id}_${activeDate}`;
  const currentPlan = plans[planKey];

  return (
    <main
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: "#fafaf8" }}
    >
      {/* Tab bar */}
      <div
        className="flex items-center overflow-x-auto flex-shrink-0"
        style={{ borderBottom: "1px solid #e0e0da", background: "#f2f2ef" }}
      >
        {openTabs.map((tab) => {
          const isActive = tab.date === activeDate;
          const isToday = tab.date === new Date().toISOString().split("T")[0];
          return (
            <div
              key={tab.date}
              className="flex items-center flex-shrink-0 gap-1.5 px-4 py-2.5 cursor-pointer transition-colors relative"
              style={{
                borderRight: "1px solid #e0e0da",
                background: isActive ? "#fafaf8" : "transparent",
                borderBottom: isActive ? "2px solid #5c9e2e" : "2px solid transparent",
              }}
              onClick={() => onTabSelect(tab.date)}
            >
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: isActive ? "#1a1a1a" : "#888" }}
              >
                {isToday ? "今日のTODO" : formatTabLabel(tab.date)}
              </span>
              {!isToday && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.date);
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center text-xs hover:bg-black/10 transition-colors flex-shrink-0"
                  style={{ color: "#aaa" }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel heading */}
      <div
        className="px-6 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid #e0e0da" }}
      >
        <div>
          <h1 className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>
            {goal.title}
          </h1>
          <p
            className="text-xs mt-0.5"
            style={{
              color: "#888",
              fontFamily: "var(--font-jetbrains-mono), monospace",
            }}
          >
            {activeDate}
          </p>
        </div>
      </div>

      {/* Day view */}
      <DayView
        date={activeDate}
        plan={currentPlan}
        goal={goal}
        plans={plans}
        allGoals={allGoals}
        onToggleTask={(taskId) => onToggleTask(activeDate, taskId)}
        onNoteChange={(note) => onNoteChange(activeDate, note)}
        onUpdateTodos={handleUpdateTodos}
        updatingTodos={updatingTodos}
        onFeedbackSubmit={onFeedbackSubmit}
      />
    </main>
  );
}
