import type { AppSettings, LLMProvider } from "@/types";

const SETTINGS_KEY = "pln_settings";

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "openai",
  apiKeys: {},
  language: "ja",
  sidebarWidth: 260,
  sidebarVisible: true,
  rightSidebarWidth: 220,
  rightSidebarVisible: true,
  googleClientId: "",
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...(parsed.apiKeys ?? {}) },
      sidebarWidth: Math.min(420, Math.max(220, parsed.sidebarWidth ?? DEFAULT_SETTINGS.sidebarWidth)),
      sidebarVisible: parsed.sidebarVisible ?? DEFAULT_SETTINGS.sidebarVisible,
      rightSidebarWidth: Math.min(360, Math.max(180, parsed.rightSidebarWidth ?? DEFAULT_SETTINGS.rightSidebarWidth)),
      rightSidebarVisible: parsed.rightSidebarVisible ?? DEFAULT_SETTINGS.rightSidebarVisible,
      googleClientId: parsed.googleClientId ?? DEFAULT_SETTINGS.googleClientId,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function providerLabel(provider: LLMProvider): string {
  return {
    openai: "OpenAI API",
    claude: "Claude AI",
    gemini: "Gemini",
  }[provider];
}

export const UI_TEXT = {
  ja: {
    today: "Today",
    settings: "設定",
    goals: "GOALS",
    tips: "学習 Tips",
    addGoal: "目標を追加",
    calendarConnected: "カレンダー連携済み",
    connectCalendar: "Googleカレンダーを連携",
    profile: "学習プロフィール",
    timeline: "TIMELINE",
    noTodos: "この日のTODOはありません",
    selectGoal: "左から目標を追加してください",
    feedback: "今日の振り返り",
    memoPlaceholder: "メモや気づきを記録...",
    artifactPlaceholder: "成果物・リンク・提出物など...",
    detail: "詳細",
    done: "完了",
    submitFeedback: "フィードバックを送信して以降のTODOを更新",
  },
  en: {
    today: "Today",
    settings: "Settings",
    goals: "GOALS",
    tips: "Learning Tips",
    addGoal: "Add goal",
    calendarConnected: "Calendar connected",
    connectCalendar: "Connect Google Calendar",
    profile: "Learning profile",
    timeline: "TIMELINE",
    noTodos: "No TODOs for this day",
    selectGoal: "Add a goal from the left sidebar",
    feedback: "Today's reflection",
    memoPlaceholder: "Write notes or insights...",
    artifactPlaceholder: "Artifacts, links, submissions...",
    detail: "Details",
    done: "Done",
    submitFeedback: "Submit feedback and update future TODOs",
  },
} as const;
