"use client";

import { useState, useCallback } from "react";
import type { Goal, DailyPlan, DailyPlansStore } from "@/types";

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
}

function formatTabLabel(date: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (date === today) return "今日";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function DayView({
  date,
  plan,
  onToggleTask,
  onNoteChange,
  onUpdateTodos,
  updatingTodos,
}: {
  date: string;
  plan: DailyPlan | undefined;
  onToggleTask: (taskId: string) => void;
  onNoteChange: (note: string) => void;
  onUpdateTodos: () => void;
  updatingTodos: boolean;
}) {
  const [noteSaved, setNoteSaved] = useState(false);
  const [localNote, setLocalNote] = useState(plan?.note ?? "");

  function handleNoteBlur() {
    onNoteChange(localNote);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  if (!plan || plan.tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ color: "#aaa" }}>
        <p className="text-sm">この日のTODOはありません</p>
      </div>
    );
  }

  const completed = plan.tasks.filter((t) => t.completed).length;
  const total = plan.tasks.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Focus */}
      {plan.focus && (
        <div
          className="px-6 py-3 text-xs font-medium"
          style={{ color: "#5c9e2e", borderBottom: "1px solid #e0e0da" }}
        >
          テーマ: {plan.focus}
        </div>
      )}

      {/* Progress */}
      <div className="px-6 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid #e0e0da" }}>
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: "#e0e0da" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.round((completed / total) * 100)}%`, background: "#5c9e2e" }}
          />
        </div>
        <span className="text-xs font-medium mono" style={{ color: "#5c9e2e", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
          {completed}/{total}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
        {plan.tasks.map((task) => (
          <label
            key={task.id}
            className="flex items-start gap-3 cursor-pointer group"
          >
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
                    <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span
              className="text-sm leading-snug"
              style={{
                color: task.completed ? "#aaa" : "#1a1a1a",
                textDecoration: task.completed ? "line-through" : "none",
              }}
            >
              {task.text}
            </span>
          </label>
        ))}
      </div>

      {/* Note area */}
      <div
        className="px-6 py-4 flex flex-col gap-2"
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
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          {updatingTodos ? "更新中..." : "TODO更新"}
        </button>
      </div>
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
          <p className="text-2xl font-bold mb-2" style={{ color: "#5c9e2e" }}>PLN</p>
          <p className="text-sm">左のサイドバーからゴールを選択してください</p>
          <p className="text-sm mt-1">または「+」で新しいゴールを追加</p>
        </div>
      </main>
    );
  }

  const planKey = goal ? `${goal.id}_${activeDate}` : "";
  const currentPlan = plans[planKey];

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "#fafaf8" }}>
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
        onToggleTask={(taskId) => onToggleTask(activeDate, taskId)}
        onNoteChange={(note) => onNoteChange(activeDate, note)}
        onUpdateTodos={handleUpdateTodos}
        updatingTodos={updatingTodos}
      />
    </main>
  );
}
