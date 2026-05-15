"use client";

import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Goal, DailyPlan, DailyPlansStore } from "@/types";
import { loadGoals, saveGoals, loadPlans, savePlans } from "@/lib/storage";
import LeftSidebar from "@/components/LeftSidebar";
import CenterPanel from "@/components/CenterPanel";
import RightTimeline from "@/components/RightTimeline";
import GoalModal from "@/components/GoalModal";

interface Tab {
  date: string;
  label: string;
}

export default function Home() {
  const today = new Date().toISOString().split("T")[0];

  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<DailyPlansStore>({});
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<Tab[]>([{ date: today, label: "今日" }]);
  const [activeDate, setActiveDate] = useState<string>(today);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [generatingTodos, setGeneratingTodos] = useState(false);
  const [updatingTodos, setUpdatingTodos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGoals(loadGoals());
    setPlans(loadPlans());
  }, []);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;

  useEffect(() => {
    if (goals.length > 0) saveGoals(goals);
  }, [goals]);

  useEffect(() => {
    if (Object.keys(plans).length > 0) savePlans(plans);
  }, [plans]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSelectGoal = useCallback(
    (goalId: string) => {
      setSelectedGoalId(goalId);
      setOpenTabs([{ date: today, label: "今日" }]);
      setActiveDate(today);
    },
    [today]
  );

  const handleTabSelect = useCallback((date: string) => {
    setActiveDate(date);
  }, []);

  const handleTabClose = useCallback(
    (date: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((t) => t.date !== date);
        return next.length === 0 ? [{ date: today, label: "今日" }] : next;
      });
      setActiveDate((prev) => (prev === date ? today : prev));
    },
    [today]
  );

  const handleSelectDate = useCallback((date: string) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.date === date)) return prev;
      return [...prev, { date, label: date }];
    });
    setActiveDate(date);
  }, []);

  const handleToggleTask = useCallback(
    (date: string, taskId: string) => {
      if (!selectedGoalId) return;
      const key = `${selectedGoalId}_${date}`;
      setPlans((prev) => {
        const plan = prev[key];
        if (!plan) return prev;
        const updated: DailyPlan = {
          ...plan,
          tasks: plan.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          ),
        };
        const next = { ...prev, [key]: updated };
        savePlans(next);
        return next;
      });
    },
    [selectedGoalId]
  );

  const handleNoteChange = useCallback(
    (date: string, note: string) => {
      if (!selectedGoalId) return;
      const key = `${selectedGoalId}_${date}`;
      setPlans((prev) => {
        const plan = prev[key] ?? { date, tasks: [], note: "", focus: "" };
        const next = { ...prev, [key]: { ...plan, note } };
        savePlans(next);
        return next;
      });
    },
    [selectedGoalId]
  );

  const handleCreateGoal = useCallback(
    async (data: Omit<Goal, "id" | "createdAt" | "color">) => {
      setGeneratingTodos(true);
      setError(null);
      try {
        const newGoal: Goal = {
          id: uuidv4(),
          ...data,
          createdAt: new Date().toISOString(),
          color: "#5c9e2e",
        };

        const res = await fetch("/api/generate-todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goalTitle: newGoal.title,
            deadline: newGoal.deadline,
            today,
            currentLevel: newGoal.currentLevel,
            dailyMinutes: newGoal.dailyMinutes,
            materials: newGoal.materials,
          }),
        });

        if (!res.ok) throw new Error("AIのTODO生成に失敗しました");

        const dailyPlan: Array<{
          date: string;
          tasks: Array<{ id: string; text: string; estimatedMinutes: number }>;
          focus: string;
        }> = await res.json();

        const newPlans: DailyPlansStore = {};
        for (const day of dailyPlan) {
          const key = `${newGoal.id}_${day.date}`;
          newPlans[key] = {
            date: day.date,
            tasks: (day.tasks || []).map((task) => ({
              id: task.id || uuidv4(),
              text: task.text,
              completed: false,
              estimatedMinutes: task.estimatedMinutes || 0,
            })),
            note: "",
            focus: day.focus,
          };
        }

        setGoals((prev) => {
          const next = [...prev, newGoal];
          saveGoals(next);
          return next;
        });
        setPlans((prev) => {
          const next = { ...prev, ...newPlans };
          savePlans(next);
          return next;
        });
        setSelectedGoalId(newGoal.id);
        setOpenTabs([{ date: today, label: "今日" }]);
        setActiveDate(today);
        setShowGoalModal(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setGeneratingTodos(false);
      }
    },
    [today]
  );

  const handleUpdateTodos = useCallback(
    async (date: string) => {
      if (!selectedGoal) return;
      const key = `${selectedGoal.id}_${date}`;
      const plan = plans[key];
      if (!plan?.note?.trim()) return;

      setUpdatingTodos(true);
      setError(null);
      try {
        const completedTasks = plan.tasks.filter((t) => t.completed).map((t) => t.text);

        const deadlineDate = new Date(selectedGoal.deadline + "T00:00:00");
        const activeD = new Date(date + "T00:00:00");
        const remainingDays = Math.max(
          0,
          Math.ceil(
            (deadlineDate.getTime() - activeD.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        const currentPlan: Array<{ date: string; tasks: string[]; focus: string }> = [];
        const d = new Date(date + "T00:00:00");
        d.setDate(d.getDate() + 1);
        const end = new Date(selectedGoal.deadline + "T00:00:00");
        while (d <= end) {
          const k = `${selectedGoal.id}_${d.toISOString().split("T")[0]}`;
          const p = plans[k];
          if (p) {
            currentPlan.push({
              date: d.toISOString().split("T")[0],
              tasks: p.tasks.map((t) => t.text),
              focus: p.focus,
            });
          }
          d.setDate(d.getDate() + 1);
        }

        const res = await fetch("/api/update-todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goalTitle: selectedGoal.title,
            note: plan.note,
            completedTasks,
            remainingDays,
            currentPlan,
          }),
        });

        if (!res.ok) throw new Error("TODO更新に失敗しました");

        const updated: Array<{ date: string; tasks: string[]; focus: string }> =
          await res.json();

        setPlans((prev) => {
          const next = { ...prev };
          for (const day of updated) {
            const k = `${selectedGoal.id}_${day.date}`;
            next[k] = {
              date: day.date,
              tasks: day.tasks.map((text) => ({
                id: uuidv4(),
                text,
                completed: false,
                estimatedMinutes: 0,
              })),
              note: prev[k]?.note ?? "",
              focus: day.focus,
            };
          }
          savePlans(next);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setUpdatingTodos(false);
      }
    },
    [selectedGoal, plans]
  );

  const handleFeedbackSubmit = useCallback((updatedPlans: DailyPlansStore) => {
    setPlans((prev) => {
      const next = { ...prev, ...updatedPlans };
      savePlans(next);
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f2f2ef" }}>
      <LeftSidebar
        goals={goals}
        selectedGoalId={selectedGoalId}
        plans={plans}
        onSelectGoal={handleSelectGoal}
        onAddGoal={() => setShowGoalModal(true)}
      />

      <CenterPanel
        goal={selectedGoal}
        plans={plans}
        openTabs={openTabs}
        activeDate={activeDate}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onToggleTask={handleToggleTask}
        onNoteChange={handleNoteChange}
        onUpdateTodos={handleUpdateTodos}
        updatingTodos={updatingTodos}
        onFeedbackSubmit={handleFeedbackSubmit}
      />

      <RightTimeline
        goal={selectedGoal}
        plans={plans}
        activeDate={activeDate}
        onSelectDate={handleSelectDate}
      />

      {showGoalModal && (
        <GoalModal
          onClose={() => setShowGoalModal(false)}
          onCreate={handleCreateGoal}
          loading={generatingTodos}
        />
      )}

      {error && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm text-white shadow-lg z-50"
          style={{ background: "#e53e3e" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
