export interface Material {
  id: string
  name: string
  structure: string
  totalPages?: number
  features?: string
  source: 'search' | 'image' | 'manual'
  imageUrl?: string
}

export type TimeCommitment = 'low' | 'medium' | 'high' | 'very_high'

export interface Goal {
  id: string
  title: string
  description: string
  deadline: string
  createdAt: string
  color: string
  currentLevel?: string
  dailyMinutes?: number
  timeCommitment?: TimeCommitment
  scheduleNote?: string
  materials: Material[]
  current_state?: string
  ideal_state?: string
  gap_summary?: string
}

export type EnergyLevel = 'deep' | 'medium' | 'light'

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
  energy_level?: EnergyLevel
  reason?: string
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

export interface Reflection {
  id: string
  task_id: string
  goal_id: string
  date: string
  what_i_did: string
  what_i_learned: string
  what_blocked_me: string
  mood: string
  next_action: string
  free_memo?: string
  created_at: string
}

export interface LearningLog {
  id: string
  date: string
  content: string
  related_goal_id: string
  created_at: string
}

export type ObservationType = 'tendency' | 'interest' | 'pattern' | 'struggle'

export interface Observation {
  id: string
  type: ObservationType
  content: string
  confidence: number
  evidence_log_ids: string[]
  created_at: string
  last_seen_at: string
  expires_at: string
}

export interface GoalPerception {
  goalId: string
  goalTitle: string
  perceived_direction: string
  motivation_signal: 'high' | 'medium' | 'low' | 'shifting'
  possible_drift?: string
  confidence: number
}

export interface WeeklyReviewResult {
  progressed: string[]
  struggled: string[]
  changed_observations: string[]
  gap_diff: string
  next_week_policy: string
  reduce_todos: string[]
  increase_todos: string[]
  goal_perception: GoalPerception[]
  weekStart: string
  weekEnd: string
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
