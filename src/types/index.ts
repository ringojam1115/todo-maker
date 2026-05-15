export interface Material {
  id: string
  name: string
  structure: string
  totalPages?: number
  features?: string
  source: 'search' | 'image' | 'manual'
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
}

export interface DailyPlan {
  date: string
  tasks: Task[]
  note: string
  focus: string
}

export type DailyPlansStore = Record<string, DailyPlan>

export interface TaskFeedback {
  taskId: string
  taskText: string
  completed: boolean
  completionRate: number
  actualMinutes: number
  estimatedMinutes: number
  difficulty: 'easy' | 'just_right' | 'hard'
  materialName?: string
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
