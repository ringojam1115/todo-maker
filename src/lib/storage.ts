import type { Goal, DailyPlansStore, DailyFeedback, LearningProfile, SkillMemo, Reflection, LearningLog, Observation, WeeklyReviewResult, TodoReaction } from "@/types";

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

const REFLECTIONS_KEY = "pln_reflections";

export function loadReflections(): Reflection[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveReflections(reflections: Reflection[]): void {
  localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(reflections));
}

const LEARNING_LOGS_KEY = "pln_learning_logs";

export function loadLearningLogs(): LearningLog[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LEARNING_LOGS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLearningLogs(logs: LearningLog[]): void {
  localStorage.setItem(LEARNING_LOGS_KEY, JSON.stringify(logs));
}

const OBSERVATIONS_KEY = "pln_observations";

export function loadObservations(): Observation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(OBSERVATIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveObservations(observations: Observation[]): void {
  localStorage.setItem(OBSERVATIONS_KEY, JSON.stringify(observations));
}

const WEEKLY_REVIEWS_KEY = "pln_weekly_reviews";

export function loadWeeklyReviews(): WeeklyReviewResult[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WEEKLY_REVIEWS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveWeeklyReview(review: WeeklyReviewResult): void {
  const existing = loadWeeklyReviews();
  const updated = [...existing.filter((r) => r.weekStart !== review.weekStart), review];
  // keep last 8 weeks
  localStorage.setItem(WEEKLY_REVIEWS_KEY, JSON.stringify(updated.slice(-8)));
}

export function loadLatestWeeklyReview(): WeeklyReviewResult | null {
  const reviews = loadWeeklyReviews();
  return reviews.length > 0 ? reviews[reviews.length - 1] : null;
}

const TODO_REACTIONS_KEY = "pln_todo_reactions";

export function loadTodoReactions(): TodoReaction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TODO_REACTIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTodoReactions(reactions: TodoReaction[]): void {
  localStorage.setItem(TODO_REACTIONS_KEY, JSON.stringify(reactions));
}
