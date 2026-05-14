import { NextResponse } from "next/server";
import type { DailyPlan } from "@/types";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const { goalTitle, note, completedTasks, remainingDays, currentPlan } = await request.json();

  const prompt = `Goal: ${goalTitle}
Today's progress note: ${note}
Completed tasks today: ${JSON.stringify(completedTasks)}
Days remaining: ${remainingDays}
Current remaining plan: ${JSON.stringify(currentPlan)}

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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content;

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const updated: DailyPlan[] = JSON.parse(cleaned);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
  }
}
