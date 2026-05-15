import { NextResponse } from "next/server";
import type { LearningProfile } from "@/types";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { profile, llm }: { profile: LearningProfile; llm?: LLMRequestSettings } = await request.json();

    const prompt = `
以下はユーザーの学習プロフィールデータです。
総合的な分析コメントを日本語で200字程度で書いてください。
強みと改善点を含め、具体的なアドバイスを1つ入れてください。
${languageInstruction(llm?.language)}

${JSON.stringify(profile, null, 2)}
`.trim();

    const comment = await callTextLLM(prompt, llm);

    return NextResponse.json({ comment });
  } catch (e) {
    console.error("[learning-comment] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
