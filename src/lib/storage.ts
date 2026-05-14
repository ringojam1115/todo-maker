import type { Goal, DailyPlansStore } from "@/types";

const GOALS_KEY = "pln_goals";
const PLANS_KEY = "pln_plans";

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
