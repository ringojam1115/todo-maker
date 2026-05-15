"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Goal, DailyPlan, DailyPlansStore, SkillMemo } from "@/types";
import type { AppSettings, Task } from "@/types";
import {
  loadGoals,
  saveGoals,
  loadPlans,
  savePlans,
  loadFeedbacks,
  saveFeedbacks,
  loadProfiles,
  saveProfiles,
  loadSkillMemos,
  saveSkillMemos,
} from "@/lib/storage";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";
import type { CalendarSlots } from "@/lib/google-calendar";
import { requestGoogleCalendarToken, getCalendarFreeSlots } from "@/lib/google-calendar";
import LeftSidebar from "@/components/LeftSidebar";
import CenterPanel from "@/components/CenterPanel";
import RightTimeline from "@/components/RightTimeline";
import GoalModal from "@/components/GoalModal";
import GoalEditModal from "@/components/GoalEditModal";
import GoalDeleteModal from "@/components/GoalDeleteModal";
import SettingsModal from "@/components/SettingsModal";

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [generatingTodos, setGeneratingTodos] = useState(false);
  const [updatingTodos, setUpdatingTodos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit / Delete modal state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  // Google Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarSlots, setCalendarSlots] = useState<CalendarSlots>({});

  // Learning Tips state
  const [tips, setTips] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<{ name: string; reason: string }[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);

  useEffect(() => {
    setGoals(loadGoals());
    setPlans(loadPlans());
    setSettings(loadSettings());
  }, []);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;
  const editingGoal = editingGoalId ? goals.find((g) => g.id === editingGoalId) ?? null : null;

  // Fetch learning tips when selected goal changes
  useEffect(() => {
    if (!selectedGoal) {
      setTips([]);
      setRecommendations([]);
      return;
    }

    const goalPlans = Object.entries(plans)
      .filter(([k]) => k.startsWith(`${selectedGoal.id}_`))
      .map(([, v]) => v);

    if (goalPlans.length === 0) return;

    setTipsLoading(true);
    const profiles = loadProfiles();
    const profile = profiles[selectedGoal.id] ?? null;

    fetch("/api/learning-tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: selectedGoal, plans: goalPlans, profile, today, llm: getLLMPayload() }),
    })
      .then((r) => r.json())
      .then((data) => {
        setTips(data.tips ?? []);
        setRecommendations(data.recommendations ?? []);
      })
      .catch(() => {})
      .finally(() => setTipsLoading(false));
  }, [selectedGoalId, settings.provider, settings.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const deletingGoal = deletingGoalId ? goals.find((g) => g.id === deletingGoalId) ?? null : null;

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
      setSelectedDate(null);
      setActiveDate(today);
    },
    [today]
  );

  const handleTabSelect = useCallback((date: string) => {
    setActiveDate(date);
  }, []);

  const handleTabClose = useCallback(
    (date: string) => {
      setSelectedDate((prev) => (prev === date ? null : prev));
      setOpenTabs([{ date: today, label: "今日" }]);
      setActiveDate((prev) => (prev === date ? today : prev));
    },
    [today]
  );

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date === today ? null : date);
    setOpenTabs(date === today ? [{ date: today, label: "今日" }] : [{ date: today, label: "今日" }, { date, label: date }]);
    setActiveDate(date);
  }, [today]);

  const getLLMPayload = useCallback(() => ({
    provider: settings.provider,
    apiKey: settings.apiKeys[settings.provider],
    language: settings.language,
  }), [settings]);

  const handleSettingsSave = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    setSettings((prev) => {
      const next = { ...prev, sidebarWidth: width };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleSidebarVisibleChange = useCallback((visible: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, sidebarVisible: visible };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleToggleTask = useCallback(
    (goalId: string, date: string, taskId: string) => {
      const key = `${goalId}_${date}`;
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
    []
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

        const otherGoals = goals.map((g) => ({
          title: g.title,
          dailyMinutes: g.dailyMinutes ?? 60,
          daysLeft: Math.max(
            0,
            Math.ceil(
              (new Date(g.deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
                (1000 * 60 * 60 * 24)
            )
          ),
        }));

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
            calendarSlots: Object.keys(calendarSlots).length > 0 ? calendarSlots : undefined,
            otherGoals: otherGoals.length > 0 ? otherGoals : undefined,
            llm: getLLMPayload(),
          }),
        });

        if (!res.ok) throw new Error("AIのTODO生成に失敗しました");

        const dailyPlan: Array<{
          date: string;
          tasks: Array<{ id: string; text: string; estimatedMinutes: number; detail?: string }>;
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
              detail: task.detail,
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
        setSelectedDate(null);
        setActiveDate(today);
        setShowGoalModal(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setGeneratingTodos(false);
      }
    },
    [today, goals, calendarSlots, getLLMPayload]
  );

  const handleEditGoal = useCallback((goalId: string) => {
    setEditingGoalId(goalId);
  }, []);

  const handleSaveGoal = useCallback(
    async (updatedGoal: Goal, regenerate: boolean) => {
      setSavingGoal(true);
      setError(null);
      try {
        setGoals((prev) => {
          const next = prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g));
          saveGoals(next);
          return next;
        });

        if (regenerate) {
          const otherGoals = goals
            .filter((g) => g.id !== updatedGoal.id)
            .map((g) => ({
              title: g.title,
              dailyMinutes: g.dailyMinutes ?? 60,
              daysLeft: Math.max(
                0,
                Math.ceil(
                  (new Date(g.deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              ),
            }));

          const res = await fetch("/api/generate-todos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              goalTitle: updatedGoal.title,
              deadline: updatedGoal.deadline,
              today,
              currentLevel: updatedGoal.currentLevel,
              dailyMinutes: updatedGoal.dailyMinutes,
              materials: updatedGoal.materials,
              calendarSlots: Object.keys(calendarSlots).length > 0 ? calendarSlots : undefined,
              otherGoals: otherGoals.length > 0 ? otherGoals : undefined,
              llm: getLLMPayload(),
            }),
          });

          if (!res.ok) throw new Error("プランの再生成に失敗しました");

          const dailyPlan: Array<{
            date: string;
            tasks: Array<{ id: string; text: string; estimatedMinutes: number; detail?: string }>;
            focus: string;
          }> = await res.json();

          setPlans((prev) => {
            const next = { ...prev };
            // Remove future plans for this goal
            for (const key of Object.keys(next)) {
              if (key.startsWith(`${updatedGoal.id}_`) && key.slice(updatedGoal.id.length + 1) >= today) {
                delete next[key];
              }
            }
            // Add regenerated plans
            for (const day of dailyPlan) {
              const key = `${updatedGoal.id}_${day.date}`;
              next[key] = {
                date: day.date,
                tasks: (day.tasks || []).map((task) => ({
                  id: task.id || uuidv4(),
                  text: task.text,
                  completed: false,
                  estimatedMinutes: task.estimatedMinutes || 0,
                  detail: task.detail,
                })),
                note: prev[key]?.note ?? "",
                focus: day.focus,
              };
            }
            savePlans(next);
            return next;
          });
        }

        setEditingGoalId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setSavingGoal(false);
      }
    },
    [today, goals, calendarSlots, getLLMPayload]
  );

  const handleDeleteGoal = useCallback((goalId: string) => {
    setDeletingGoalId(goalId);
  }, []);

  const handleConfirmDelete = useCallback(
    (skillMemoText: string) => {
      if (!deletingGoalId) return;
      const goal = goals.find((g) => g.id === deletingGoalId);
      if (!goal) return;

      // Save skill memo if provided
      if (skillMemoText.trim()) {
        const memo: SkillMemo = {
          id: uuidv4(),
          goalId: deletingGoalId,
          goalTitle: goal.title,
          skills: skillMemoText.trim(),
          source: "deleted",
          createdAt: new Date().toISOString(),
        };
        const existing = loadSkillMemos();
        saveSkillMemos([...existing, memo]);
      }

      // Remove goal
      setGoals((prev) => {
        const next = prev.filter((g) => g.id !== deletingGoalId);
        saveGoals(next);
        return next;
      });

      // Remove all plans for this goal
      setPlans((prev) => {
        const next: DailyPlansStore = {};
        for (const [k, v] of Object.entries(prev)) {
          if (!k.startsWith(`${deletingGoalId}_`)) next[k] = v;
        }
        savePlans(next);
        return next;
      });

      // Remove feedbacks + profiles
      const feedbacks = loadFeedbacks();
      saveFeedbacks(feedbacks.filter((f) => f.goalId !== deletingGoalId));
      const profiles = loadProfiles();
      delete profiles[deletingGoalId];
      saveProfiles(profiles);

      // Clear selection if deleted goal was selected
      if (selectedGoalId === deletingGoalId) {
        setSelectedGoalId(null);
        setOpenTabs([{ date: today, label: "今日" }]);
        setSelectedDate(null);
        setActiveDate(today);
      }

      setDeletingGoalId(null);
    },
    [deletingGoalId, goals, selectedGoalId, today]
  );

  const handleConnectCalendar = useCallback(async (settingsOverride?: AppSettings) => {
    if (calendarConnected) return;
    const activeSettings = settingsOverride ?? settings;
    try {
      const token = await requestGoogleCalendarToken(activeSettings.googleClientId);
      const slots = await getCalendarFreeSlots(token);
      setCalendarSlots(slots);
      setCalendarConnected(true);
    } catch {
      setError("Googleカレンダーの連携に失敗しました");
    }
  }, [calendarConnected, settings]);

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
            llm: getLLMPayload(),
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
    [selectedGoal, plans, getLLMPayload]
  );

  const handleFeedbackSubmit = useCallback((updatedPlans: DailyPlansStore) => {
    setPlans((prev) => {
      const next = { ...prev, ...updatedPlans };
      savePlans(next);
      return next;
    });
  }, []);

  const handleTaskMetaChange = useCallback(
    (goalId: string, date: string, taskId: string, patch: Pick<Task, "reflection" | "artifact">) => {
      const key = `${goalId}_${date}`;
      setPlans((prev) => {
        const plan = prev[key];
        if (!plan) return prev;
        const next = {
          ...prev,
          [key]: {
            ...plan,
            tasks: plan.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
          },
        };
        savePlans(next);
        return next;
      });
    },
    []
  );

  // Collect plans and feedbacks for the delete modal
  const deletingGoalPlans = useMemo(
    () =>
      deletingGoalId
        ? Object.entries(plans)
            .filter(([k]) => k.startsWith(`${deletingGoalId}_`))
            .map(([, v]) => v)
        : [],
    [deletingGoalId, plans]
  );
  const deletingGoalFeedbacks = useMemo(
    () =>
      deletingGoalId ? loadFeedbacks().filter((f) => f.goalId === deletingGoalId) : [],
    [deletingGoalId]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {settings.sidebarVisible ? (
        <LeftSidebar
          goals={goals}
          selectedGoalId={selectedGoalId}
          plans={plans}
          width={settings.sidebarWidth}
          language={settings.language}
          onWidthChange={handleSidebarWidthChange}
          onSelectGoal={handleSelectGoal}
          onAddGoal={() => setShowGoalModal(true)}
          onEditGoal={handleEditGoal}
          onDeleteGoal={handleDeleteGoal}
          onHideSidebar={() => handleSidebarVisibleChange(false)}
          onOpenSettings={() => setShowSettingsModal(true)}
          tips={tips}
          recommendations={recommendations}
          tipsLoading={tipsLoading}
        />
      ) : (
        <div className="flex w-12 min-w-12 flex-col items-center border-r border-[var(--border)] bg-[var(--panel)] py-3">
          <button
            onClick={() => handleSidebarVisibleChange(true)}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-white text-sm text-[var(--text)]"
            title={settings.language === "ja" ? "サイドバーを表示" : "Show sidebar"}
          >
            pl
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="mt-3 grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-white text-sm text-[var(--muted)]"
            title={settings.language === "ja" ? "設定" : "Settings"}
          >
            ⚙
          </button>
        </div>
      )}

      <CenterPanel
        goals={goals}
        plans={plans}
        activeDate={activeDate}
        selectedDate={selectedDate}
        language={settings.language}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onToggleTask={handleToggleTask}
        onTaskMetaChange={handleTaskMetaChange}
        onFeedbackSubmit={handleFeedbackSubmit}
        llmPayload={getLLMPayload}
      />

      <RightTimeline
        goals={goals}
        plans={plans}
        activeDate={activeDate}
        language={settings.language}
        onSelectDate={handleSelectDate}
      />

      {showGoalModal && (
        <GoalModal
          onClose={() => setShowGoalModal(false)}
          onCreate={handleCreateGoal}
          loading={generatingTodos}
          activeGoals={goals}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          calendarConnected={calendarConnected}
          onConnectCalendar={handleConnectCalendar}
          onSave={handleSettingsSave}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {editingGoal && (
        <GoalEditModal
          goal={editingGoal}
          onClose={() => setEditingGoalId(null)}
          onSave={handleSaveGoal}
          loading={savingGoal}
        />
      )}

      {deletingGoal && (
        <GoalDeleteModal
          goal={deletingGoal}
          plans={deletingGoalPlans}
          feedbacks={deletingGoalFeedbacks}
          onClose={() => setDeletingGoalId(null)}
          onDelete={handleConfirmDelete}
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
