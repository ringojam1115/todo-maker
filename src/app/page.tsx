"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Goal, DailyPlan, DailyPlansStore, SkillMemo, TaskFeedback, LearningProfile, Observation, WeeklyReviewResult } from "@/types";
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
  loadTipsCache,
  saveTipsForGoal,
  loadObservations,
  saveObservations,
  loadReflections,
  loadLearningLogs,
  loadLatestWeeklyReview,
  saveWeeklyReview,
} from "@/lib/storage";
import { DEFAULT_SETTINGS, GOAL_COLORS, loadSettings, saveSettings } from "@/lib/settings";
import type { CalendarSlots } from "@/lib/google-calendar";
import { requestGoogleCalendarToken, getCalendarFreeSlots } from "@/lib/google-calendar";
import LeftSidebar from "@/components/LeftSidebar";
import CenterPanel from "@/components/CenterPanel";
import RightTimeline from "@/components/RightTimeline";
import GoalModal from "@/components/GoalModal";
import GoalEditModal from "@/components/GoalEditModal";
import GoalDeleteModal from "@/components/GoalDeleteModal";
import SettingsModal from "@/components/SettingsModal";
import WeeklyReviewModal from "@/components/WeeklyReviewModal";
import YesterdayFeedbackModal from "@/components/YesterdayFeedbackModal";

interface Tab {
  date: string;
  label: string;
  weekEnd?: string;
}

export default function Home() {
  const today = new Date().toISOString().split("T")[0];

  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<DailyPlansStore>({});
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<Tab[]>([{ date: today, label: "今日" }]);
  const [activeDate, setActiveDate] = useState<string>(today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null);
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

  // Observations state
  const [observations, setObservations] = useState<Observation[]>([]);

  // Weekly Review modal
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [latestWeeklyReview, setLatestWeeklyReview] = useState<WeeklyReviewResult | null>(null);

  // Auto-submit state
  const [dataLoaded, setDataLoaded] = useState(false);
  const [autoSubmitStatus, setAutoSubmitStatus] = useState<string | null>(null);

  // Yesterday feedback modal
  const [pendingFeedbackDate, setPendingFeedbackDate] = useState<string | null>(null);
  const [submittingYesterdayFeedback, setSubmittingYesterdayFeedback] = useState(false);

  // Refs for stable access inside scheduled callbacks (avoids stale closures)
  const goalsRef = useRef<Goal[]>([]);
  const plansRef = useRef<DailyPlansStore>({});
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loaded = loadGoals();
    // Migrate goals that still have the legacy single color
    const legacyColors = new Set(["#5c9e2e", "#5f8f3b"]);
    const allLegacy = loaded.every((g) => legacyColors.has(g.color));
    const migrated = allLegacy
      ? loaded.map((g, i) => ({ ...g, color: GOAL_COLORS[i % GOAL_COLORS.length] }))
      : loaded;
    if (allLegacy && migrated.length > 0) saveGoals(migrated);
    const loadedPlans = loadPlans();
    const loadedSettings = loadSettings();
    goalsRef.current = migrated;
    plansRef.current = loadedPlans;
    settingsRef.current = loadedSettings;
    const loadedObservations = loadObservations().filter(
      (o) => new Date(o.expires_at) > new Date()
    );
    setGoals(migrated);
    setPlans(loadedPlans);
    setSettings(loadedSettings);
    setObservations(loadedObservations);
    setLatestWeeklyReview(loadLatestWeeklyReview());
    setDataLoaded(true);

    // Detect pending yesterday feedback
    const todayStr = new Date().toISOString().split("T")[0];

    // Reuse an existing pending date stored from a previous session
    const stored = localStorage.getItem("pln_pending_feedback");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date && parsed.date < todayStr) {
          setPendingFeedbackDate(parsed.date);
          return;
        }
      } catch {}
    }

    // Simple date-level check: if pln_feedbacks has no entry for yesterday,
    // prompt the user to submit before falling through to the per-goal scan.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const feedbacks = loadFeedbacks();
    const hasYesterdayFeedback = feedbacks.some((f) => f.date === yesterdayStr);

    if (!hasYesterdayFeedback) {
      const hasYesterdayPlans = Object.keys(loadedPlans).some((key) => {
        const idx = key.indexOf("_");
        return idx !== -1 && key.slice(idx + 1) === yesterdayStr;
      });
      if (hasYesterdayPlans) {
        localStorage.setItem("pln_pending_feedback", JSON.stringify({ date: yesterdayStr }));
        setPendingFeedbackDate(yesterdayStr);
        return;
      }
    }

    // Find past dates that have plans but no feedback (per-goal scan for dates older than yesterday)
    const missingDates = new Set<string>();
    for (const key of Object.keys(loadedPlans)) {
      const idx = key.indexOf("_");
      if (idx === -1) continue;
      const date = key.slice(idx + 1);
      if (date >= todayStr) continue;
      const goalId = key.slice(0, idx);
      if (!feedbacks.some((f) => f.goalId === goalId && f.date === date)) {
        missingDates.add(date);
      }
    }

    if (missingDates.size === 0) return;

    const sortedMissing = Array.from(missingDates).sort().reverse();
    const targetDate = sortedMissing[0]; // most recent missing date
    const olderDates = sortedMissing.slice(1);

    // Auto-record dates older than targetDate as "no data" to prevent infinite prompts
    if (olderDates.length > 0) {
      const noDataFeedbacks = [...feedbacks];
      for (const oldDate of olderDates) {
        for (const key of Object.keys(loadedPlans)) {
          const idx = key.indexOf("_");
          if (idx === -1) continue;
          if (key.slice(idx + 1) !== oldDate) continue;
          const goalId = key.slice(0, idx);
          if (noDataFeedbacks.some((f) => f.goalId === goalId && f.date === oldDate)) continue;
          noDataFeedbacks.push({
            date: oldDate,
            goalId,
            taskFeedbacks: [],
            overallNote: "",
            energyLevel: "medium",
            createdAt: new Date().toISOString(),
          });
        }
      }
      saveFeedbacks(noDataFeedbacks);
    }

    localStorage.setItem("pln_pending_feedback", JSON.stringify({ date: targetDate }));
    setPendingFeedbackDate(targetDate);
  }, []);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;
  const editingGoal = editingGoalId ? goals.find((g) => g.id === editingGoalId) ?? null : null;

  const deletingGoal = deletingGoalId ? goals.find((g) => g.id === deletingGoalId) ?? null : null;

  useEffect(() => {
    if (goals.length > 0) saveGoals(goals);
    goalsRef.current = goals;
  }, [goals]);

  useEffect(() => {
    if (Object.keys(plans).length > 0) savePlans(plans);
    plansRef.current = plans;
  }, [plans]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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
      // Load cached tips for the selected goal (no API call)
      const cached = loadTipsCache()[goalId];
      setTips(cached?.tips ?? []);
      setRecommendations(cached?.recommendations ?? []);
    },
    [today]
  );

  const handleTabSelect = useCallback((date: string, weekEnd?: string) => {
    setActiveDate(date);
    if (weekEnd) {
      setWeekRange({ start: date, end: weekEnd });
    } else {
      setWeekRange(null);
    }
  }, []);

  const handleTabClose = useCallback(
    (date: string) => {
      setWeekRange(null);
      setSelectedDate((prev) => (prev === date ? null : prev));
      setOpenTabs([{ date: today, label: "今日" }]);
      setActiveDate((prev) => (prev === date ? today : prev));
    },
    [today]
  );

  const handleSelectDate = useCallback((date: string) => {
    setWeekRange(null);
    setSelectedDate(date === today ? null : date);
    setOpenTabs(date === today ? [{ date: today, label: "今日" }] : [{ date: today, label: "今日" }, { date, label: date }]);
    setActiveDate(date);
  }, [today]);

  const handleSelectWeek = useCallback((start: string, end: string) => {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    const label = `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()}`;
    setWeekRange({ start, end });
    setActiveDate(start);
    setSelectedDate(null);
    setOpenTabs([{ date: today, label: "今日" }, { date: start, label, weekEnd: end }]);
  }, [today]);

  const getLLMPayload = useCallback(() => ({
    provider: settings.provider,
    apiKey: settings.apiKeys[settings.provider],
    language: settings.language,
  }), [settings]);

  // At each midnight, check if yesterday's feedback is missing and set the pending flag.
  useEffect(() => {
    if (!dataLoaded) return;

    const checkYesterday = () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const currentGoals = goalsRef.current;
      const currentPlans = plansRef.current;
      if (currentGoals.length === 0) return;

      const existingFeedbacks = loadFeedbacks();
      const hasPending = currentGoals.some((goal) => {
        const plan = currentPlans[`${goal.id}_${yesterdayStr}`];
        return plan != null && !existingFeedbacks.some((f) => f.goalId === goal.id && f.date === yesterdayStr);
      });

      if (hasPending) {
        localStorage.setItem("pln_pending_feedback", JSON.stringify({ date: yesterdayStr }));
        setPendingFeedbackDate(yesterdayStr);
      }
    };

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 5, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    let dailyInterval: ReturnType<typeof setInterval> | null = null;
    const midnightTimeout = setTimeout(() => {
      checkYesterday();
      dailyInterval = setInterval(checkYesterday, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => {
      clearTimeout(midnightTimeout);
      if (dailyInterval) clearInterval(dailyInterval);
    };
  }, [dataLoaded]);

  const handleYesterdayFeedbackSkip = useCallback(() => {
    localStorage.removeItem("pln_pending_feedback");
    setPendingFeedbackDate(null);
  }, []);

  const handleYesterdayFeedbackSubmit = useCallback(
    async ({
      completionRate,
      energyLevel,
      memo,
    }: {
      completionRate: number;
      energyLevel: "low" | "medium" | "high";
      memo: string;
    }) => {
      if (!pendingFeedbackDate) return;
      setSubmittingYesterdayFeedback(true);

      const date = pendingFeedbackDate;
      const currentGoals = goalsRef.current;
      const currentPlans = plansRef.current;
      const existingFeedbacks = loadFeedbacks();
      const profiles = loadProfiles();

      const goalsNeedingFeedback = currentGoals.filter((goal) => {
        const plan = currentPlans[`${goal.id}_${date}`];
        return plan != null && !existingFeedbacks.some((f) => f.goalId === goal.id && f.date === date);
      });

      const nextFeedbacks = [...existingFeedbacks];
      const updatedStore: DailyPlansStore = {};

      for (const goal of goalsNeedingFeedback) {
        const plan = currentPlans[`${goal.id}_${date}`];
        const taskFeedbacks: TaskFeedback[] = plan.tasks.map((task) => ({
          taskId: task.id,
          taskText: task.text,
          completed: completionRate >= 100,
          completionRate,
          actualMinutes: task.actualMinutes ?? task.estimatedMinutes ?? 30,
          estimatedMinutes: task.estimatedMinutes || 30,
          difficulty: task.difficulty ?? "just_right",
          materialName: goal.materials?.[0]?.name,
          reflection: task.reflection,
          artifact: task.artifact,
        }));

        const deadlineDate = new Date(goal.deadline + "T00:00:00");
        const currentD = new Date(date + "T00:00:00");
        const remainingDays = Math.max(
          0,
          Math.ceil((deadlineDate.getTime() - currentD.getTime()) / (1000 * 60 * 60 * 24))
        );

        const currentPlanItems: DailyPlan[] = [];
        const d = new Date(date + "T00:00:00");
        d.setDate(d.getDate() + 1);
        while (d <= deadlineDate) {
          const dateStr = d.toISOString().split("T")[0];
          const future = currentPlans[`${goal.id}_${dateStr}`];
          if (future) currentPlanItems.push(future);
          d.setDate(d.getDate() + 1);
        }

        const currentProfile: LearningProfile = profiles[goal.id] || {
          goalId: goal.id,
          averageCompletionRate: 0,
          averageTimeRatio: 1,
          materialAffinities: [],
          difficultyTrend: "stable",
          totalStudyMinutes: 0,
          updatedAt: new Date().toISOString(),
        };

        const otherGoals = currentGoals
          .filter((g) => g.id !== goal.id)
          .map((g) => ({
            title: g.title,
            dailyMinutes: g.dailyMinutes ?? 60,
            remainingDays: Math.max(
              0,
              Math.ceil(
                (new Date(g.deadline + "T00:00:00").getTime() - currentD.getTime()) / (1000 * 60 * 60 * 24)
              )
            ),
          }));

        try {
          const res = await fetch("/api/submit-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              goal,
              date,
              taskFeedbacks,
              overallNote: memo,
              energyLevel,
              remainingDays,
              currentPlans: currentPlanItems,
              profile: currentProfile,
              otherGoals,
              llm: {
                provider: settingsRef.current.provider,
                apiKey: settingsRef.current.apiKeys[settingsRef.current.provider],
                language: settingsRef.current.language,
              },
            }),
          });

          if (!res.ok) continue;
          const data = await res.json();
          profiles[goal.id] = data.updatedProfile;

          for (const dayPlan of data.updatedPlans as Array<{ date: string; focus: string; tasks: Task[] }>) {
            const key = `${goal.id}_${dayPlan.date}`;
            updatedStore[key] = {
              date: dayPlan.date,
              focus: dayPlan.focus,
              tasks: dayPlan.tasks.map((task) => ({ ...task, completed: false })),
              note: currentPlans[key]?.note ?? "",
            };
          }

          nextFeedbacks.push({
            date,
            goalId: goal.id,
            taskFeedbacks,
            overallNote: memo,
            energyLevel,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // continue to next goal if one fails
        }
      }

      saveFeedbacks(nextFeedbacks);
      saveProfiles(profiles);

      if (Object.keys(updatedStore).length > 0) {
        setPlans((prev) => {
          const next = { ...prev, ...updatedStore };
          savePlans(next);
          return next;
        });
      }

      localStorage.removeItem("pln_pending_feedback");
      setPendingFeedbackDate(null);
      setSubmittingYesterdayFeedback(false);

      const lang = settingsRef.current.language;
      setAutoSubmitStatus(
        lang === "ja"
          ? "昨日のフィードバックをもとにtodoを更新しました"
          : "Updated TODOs based on yesterday's feedback"
      );
      setTimeout(() => setAutoSubmitStatus(null), 5000);
    },
    [pendingFeedbackDate]
  );

  const fetchTipsForGoal = useCallback((goal: Goal, allPlans: DailyPlansStore) => {
    const goalPlans = Object.entries(allPlans)
      .filter(([k]) => k.startsWith(`${goal.id}_`))
      .map(([, v]) => v);
    if (goalPlans.length === 0) return;
    setTipsLoading(true);
    const profiles = loadProfiles();
    const profile = profiles[goal.id] ?? null;
    const allReflections = loadReflections();
    const recentReflections = allReflections
      .filter((r) => r.goal_id === goal.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map((r) => ({
        date: r.date,
        what_i_learned: r.what_i_learned,
        what_blocked_me: r.what_blocked_me,
        mood: r.mood,
      }));
    const currentObs = loadObservations().filter((o) => new Date(o.expires_at) > new Date());
    fetch("/api/learning-tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        plans: goalPlans,
        profile,
        today,
        observations: currentObs,
        recentReflections,
        llm: getLLMPayload(),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const t = data.tips ?? [];
        const r = data.recommendations ?? [];
        setTips(t);
        setRecommendations(r);
        saveTipsForGoal(goal.id, t, r);
      })
      .catch(() => {})
      .finally(() => setTipsLoading(false));
  }, [today, getLLMPayload]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleRightSidebarWidthChange = useCallback((width: number) => {
    setSettings((prev) => {
      const next = { ...prev, rightSidebarWidth: width };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleToggleTask = useCallback(
    (goalId: string, date: string, taskId: string) => {
      if (date !== today) return;
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
    [today]
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
          color: GOAL_COLORS[goals.length % GOAL_COLORS.length],
        };

        const otherGoals = goals.map((g) => ({
          title: g.title,
          timeCommitment: g.timeCommitment,
          dailyMinutes: g.dailyMinutes,
          daysLeft: Math.max(
            0,
            Math.ceil(
              (new Date(g.deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
                (1000 * 60 * 60 * 24)
            )
          ),
        }));

        const recentFeedbacks = loadFeedbacks()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 7)
          .map((f) => ({ date: f.date, energyLevel: f.energyLevel, overallNote: f.overallNote }));

        const acquiredSkills = loadSkillMemos()
          .map((s) => ({ goalTitle: s.goalTitle, skills: s.skills }));

        const recentLearningLogs = loadLearningLogs()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5)
          .map((l) => ({ date: l.date, content: l.content }));

        const res = await fetch("/api/generate-todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goalTitle: newGoal.title,
            deadline: newGoal.deadline,
            today,
            timeCommitment: newGoal.timeCommitment,
            scheduleNote: newGoal.scheduleNote,
            materials: newGoal.materials,
            calendarSlots: Object.keys(calendarSlots).length > 0 ? calendarSlots : undefined,
            otherGoals: otherGoals.length > 0 ? otherGoals : undefined,
            currentState: newGoal.current_state,
            idealState: newGoal.ideal_state,
            gapSummary: newGoal.gap_summary,
            observations: observations.length > 0 ? observations : undefined,
            recentFeedbacks: recentFeedbacks.length > 0 ? recentFeedbacks : undefined,
            acquiredSkills: acquiredSkills.length > 0 ? acquiredSkills : undefined,
            recentLearningLogs: recentLearningLogs.length > 0 ? recentLearningLogs : undefined,
            weeklyReview: latestWeeklyReview
              ? {
                  next_week_policy: latestWeeklyReview.next_week_policy,
                  reduce_todos: latestWeeklyReview.reduce_todos,
                  increase_todos: latestWeeklyReview.increase_todos,
                  goal_perception: latestWeeklyReview.goal_perception,
                  weekStart: latestWeeklyReview.weekStart,
                }
              : undefined,
            llm: getLLMPayload(),
          }),
        });

        if (!res.ok) throw new Error("AIのTODO生成に失敗しました");

        const dailyPlan: Array<{
          date: string;
          tasks: Array<{ id: string; text: string; estimatedMinutes: number; detail?: string; energy_level?: string; reason?: string }>;
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
              energy_level: task.energy_level as Task["energy_level"],
              reason: task.reason,
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
        fetchTipsForGoal(newGoal, { ...plans, ...newPlans });
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setGeneratingTodos(false);
      }
    },
    [today, goals, calendarSlots, getLLMPayload, fetchTipsForGoal, plans, observations]
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
              timeCommitment: g.timeCommitment,
              dailyMinutes: g.dailyMinutes,
              daysLeft: Math.max(
                0,
                Math.ceil(
                  (new Date(g.deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              ),
            }));

          const allReflections = loadReflections();
          const recentReflections = allReflections
            .filter((r) => r.goal_id === updatedGoal.id)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 3)
            .map((r) => ({ date: r.date, what_i_learned: r.what_i_learned, what_blocked_me: r.what_blocked_me, mood: r.mood }));

          const profiles = loadProfiles();
          const goalProfile = profiles[updatedGoal.id];

          const res = await fetch("/api/generate-todos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              goalTitle: updatedGoal.title,
              deadline: updatedGoal.deadline,
              today,
              timeCommitment: updatedGoal.timeCommitment,
              scheduleNote: updatedGoal.scheduleNote,
              materials: updatedGoal.materials,
              calendarSlots: Object.keys(calendarSlots).length > 0 ? calendarSlots : undefined,
              otherGoals: otherGoals.length > 0 ? otherGoals : undefined,
              currentState: updatedGoal.current_state,
              idealState: updatedGoal.ideal_state,
              gapSummary: updatedGoal.gap_summary,
              recentReflections: recentReflections.length > 0 ? recentReflections : undefined,
              observations: observations.length > 0 ? observations : undefined,
              learningProfile: goalProfile ?? undefined,
              weeklyReview: latestWeeklyReview
                ? {
                    next_week_policy: latestWeeklyReview.next_week_policy,
                    reduce_todos: latestWeeklyReview.reduce_todos,
                    increase_todos: latestWeeklyReview.increase_todos,
                    goal_perception: latestWeeklyReview.goal_perception,
                    weekStart: latestWeeklyReview.weekStart,
                  }
                : undefined,
              llm: getLLMPayload(),
            }),
          });

          if (!res.ok) throw new Error("プランの再生成に失敗しました");

          const dailyPlan: Array<{
            date: string;
            tasks: Array<{ id: string; text: string; estimatedMinutes: number; detail?: string; energy_level?: string; reason?: string }>;
            focus: string;
          }> = await res.json();

          setPlans((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              if (key.startsWith(`${updatedGoal.id}_`) && key.slice(updatedGoal.id.length + 1) >= today) {
                delete next[key];
              }
            }
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
                  energy_level: task.energy_level as Task["energy_level"],
                  reason: task.reason,
                })),
                note: prev[key]?.note ?? "",
                focus: day.focus,
              };
            }
            savePlans(next);
            fetchTipsForGoal(updatedGoal, next);
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
    [today, goals, calendarSlots, getLLMPayload, fetchTipsForGoal, observations]
  );

  const handleObservationsUpdate = useCallback((updated: Observation[]) => {
    setObservations(updated);
    saveObservations(updated);
  }, []);

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
          if (selectedGoal) fetchTipsForGoal(selectedGoal, next);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setUpdatingTodos(false);
      }
    },
    [selectedGoal, plans, getLLMPayload, fetchTipsForGoal]
  );

  const handleFeedbackSubmit = useCallback((updatedPlans: DailyPlansStore) => {
    setPlans((prev) => {
      const next = { ...prev, ...updatedPlans };
      savePlans(next);
      if (selectedGoal) fetchTipsForGoal(selectedGoal, next);
      return next;
    });
  }, [selectedGoal, fetchTipsForGoal]);

  const handleTaskMetaChange = useCallback(
    (goalId: string, date: string, taskId: string, patch: Partial<Pick<Task, "reflection" | "artifact" | "actualMinutes" | "difficulty">>) => {
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
          observations={observations}
          onObservationsUpdate={handleObservationsUpdate}
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
        weekRange={weekRange}
        language={settings.language}
        observations={observations}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onToggleTask={handleToggleTask}
        onTaskMetaChange={handleTaskMetaChange}
        onFeedbackSubmit={handleFeedbackSubmit}
        onObservationsUpdate={handleObservationsUpdate}
        onWeeklyReview={() => setShowWeeklyReview(true)}
        llmPayload={getLLMPayload}
      />

      <RightTimeline
        goals={goals}
        plans={plans}
        activeDate={activeDate}
        language={settings.language}
        width={settings.rightSidebarWidth}
        onWidthChange={handleRightSidebarWidthChange}
        onSelectDate={handleSelectDate}
        onSelectWeek={handleSelectWeek}
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

      {pendingFeedbackDate && (
        <YesterdayFeedbackModal
          date={pendingFeedbackDate}
          goals={goals}
          plans={plans}
          language={settings.language}
          submitting={submittingYesterdayFeedback}
          onSkip={handleYesterdayFeedbackSkip}
          onSubmit={handleYesterdayFeedbackSubmit}
        />
      )}

      {showWeeklyReview && (
        <WeeklyReviewModal
          goals={goals}
          observations={observations}
          language={settings.language}
          onClose={() => setShowWeeklyReview(false)}
          onSave={(review) => {
            saveWeeklyReview(review);
            setLatestWeeklyReview(review);
          }}
          llmPayload={getLLMPayload}
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

      {autoSubmitStatus && (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg bg-[var(--text)] px-5 py-3 text-center text-sm text-white shadow-lg">
          {autoSubmitStatus}
        </div>
      )}
    </div>
  );
}
