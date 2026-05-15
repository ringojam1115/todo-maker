import type { Goal, DailyPlansStore, DailyFeedback, LearningProfile } from "@/types";

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
