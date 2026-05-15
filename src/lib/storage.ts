import type { Goal, DailyPlansStore, DailyFeedback, LearningProfile, SkillMemo } from "@/types";

const GOALS_KEY = "pln_goals";
const PLANS_KEY = "pln_plans";
const FEEDBACKS_KEY = "pln_feedbacks";
const PROFILES_KEY = "pln_profiles";

export function loadGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GOALS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function loadPlans(): DailyPlansStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function savePlans(plans: DailyPlansStore): void {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export function loadFeedbacks(): DailyFeedback[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FEEDBACKS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveFeedbacks(feedbacks: DailyFeedback[]): void {
  localStorage.setItem(FEEDBACKS_KEY, JSON.stringify(feedbacks));
}

export function loadProfiles(): Record<string, LearningProfile> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: Record<string, LearningProfile>): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

const SKILLS_KEY = "pln_skills";

export function loadSkillMemos(): SkillMemo[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SKILLS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveSkillMemos(memos: SkillMemo[]): void {
  localStorage.setItem(SKILLS_KEY, JSON.stringify(memos));
}

const TIPS_KEY = "pln_tips";

interface TipsCache {
  tips: string[];
  recommendations: { name: string; reason: string }[];
}

export function loadTipsCache(): Record<string, TipsCache> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(TIPS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveTipsForGoal(goalId: string, tips: string[], recommendations: { name: string; reason: string }[]): void {
  const all = loadTipsCache();
  all[goalId] = { tips, recommendations };
  localStorage.setItem(TIPS_KEY, JSON.stringify(all));
}
