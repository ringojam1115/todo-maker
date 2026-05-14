import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const { goalTitle, goalDescription, deadline, today } = await request.json();

  const deadlineDate = new Date(deadline);
  const todayDate = new Date(today);
  const daysLeft = Math.ceil((deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  const prompt = `Goal: ${goalTitle}
Description: ${goalDescription}
Days until deadline: ${daysLeft}
Today's date: ${today}
Deadline: ${deadline}

Create a realistic day-by-day TODO plan in Japanese.
Return JSON array only, no explanation, no markdown:
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
    const errJson = await res.json().catch(() => null);
    const message = errJson?.error?.message ?? `OpenAI error ${res.status}`;
    console.error("[generate-todos] OpenAI error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content;

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const plan = JSON.parse(cleaned);
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
  }
}
