export interface Material {
  id: string
  name: string
  structure: string
  totalPages?: number
  features?: string
  source: 'search' | 'image' | 'manual'
  imageUrl?: string
}

export interface Goal {
  id: string
  title: string
  description: string
  deadline: string
  createdAt: string
  color: string
  currentLevel: string
  dailyMinutes: number
  materials: Material[]
}

export interface Task {
  id: string
  text: string
  completed: boolean
  estimatedMinutes: number
  detail?: string
  reflection?: string
  artifact?: string
  actualMinutes?: number
  difficulty?: Difficulty
}

export interface DailyPlan {
  date: string
  tasks: Task[]
  note: string
  focus: string
}

export type DailyPlansStore = Record<string, DailyPlan>

export type Difficulty = 'easy' | 'just_right' | 'hard'

export interface TaskFeedback {
  taskId: string
  taskText: string
  completed: boolean
  completionRate: number
  actualMinutes: number
  estimatedMinutes: number
  difficulty: Difficulty
  materialName?: string
  reflection?: string
  artifact?: string
}

export interface DailyFeedback {
  date: string
  goalId: string
  taskFeedbacks: TaskFeedback[]
  overallNote: string
  energyLevel: 'low' | 'medium' | 'high'
  createdAt: string
}

export interface MaterialAffinity {
  materialName: string
  completionRate: number
  difficultyAverage: number
  totalMinutes: number
  sessionCount: number
}

export interface LearningProfile {
  goalId: string
  averageCompletionRate: number
  averageTimeRatio: number
  materialAffinities: MaterialAffinity[]
  difficultyTrend: 'improving' | 'stable' | 'struggling'
  totalStudyMinutes: number
  updatedAt: string
}

export interface SkillMemo {
  id: string
  goalId: string
  goalTitle: string
  skills: string
  source: 'deleted' | 'completed'
  createdAt: string
}

export type LLMProvider = 'openai' | 'claude' | 'gemini'
export type AppLanguage = 'ja' | 'en'

export interface AppSettings {
  provider: LLMProvider
  apiKeys: Partial<Record<LLMProvider, string>>
  language: AppLanguage
  sidebarWidth: number
  sidebarVisible: boolean
  rightSidebarWidth: number
  googleClientId?: string
}
