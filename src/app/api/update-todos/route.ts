import { NextResponse } from "next/server";
import type { DailyPlan } from "@/types";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";

export async function POST(request: Request) {
  const { goalTitle, note, completedTasks, remainingDays, currentPlan, llm }: { llm?: LLMRequestSettings } & Record<string, unknown> = await request.json();

  const prompt = `Goal: ${goalTitle}
Today's progress note: ${note}
Completed tasks today: ${JSON.stringify(completedTasks)}
Days remaining: ${remainingDays}
Current remaining plan: ${JSON.stringify(currentPlan)}
${languageInstruction(llm?.language)}

Based on today's progress, adjust the remaining daily TODO plan.
Return updated JSON plan for remaining days only.
Return only valid JSON array, no explanation, no markdown:
[
  {
    "date": "YYYY-MM-DD",
    "tasks": ["task1", "task2"],
    "focus": "main theme for the day"
  }
]`;

  try {
    const text = await callTextLLM(prompt, llm);
    const updated: DailyPlan[] = parseJsonText(text);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update TODOs" }, { status: 500 });
  }
}
