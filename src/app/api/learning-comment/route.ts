import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";
import type { LearningProfile } from "@/types";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const { profile }: { profile: LearningProfile } = await request.json();

    const prompt = `
以下はユーザーの学習プロフィールデータです。
総合的な分析コメントを日本語で200字程度で書いてください。
強みと改善点を含め、具体的なアドバイスを1つ入れてください。

${JSON.stringify(profile, null, 2)}
`.trim();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODELS.MAIN,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const message = errJson?.error?.message ?? `OpenAI error ${res.status}`;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const data = await res.json();
    const comment: string = data.choices[0].message.content;

    return NextResponse.json({ comment });
  } catch (e) {
    console.error("[learning-comment] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
