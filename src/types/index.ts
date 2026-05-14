export interface Goal {
  id: string;
  title: string;
  description: string;
  deadline: string;
  createdAt: string;
  color: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface DailyPlan {
  date: string;
  tasks: Task[];
  note: string;
  focus: string;
}

export type DailyPlansStore = Record<string, DailyPlan>;
