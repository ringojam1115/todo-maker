import { NextResponse } from "next/server";
import type { Goal, DailyPlan, LearningProfile, Observation } from "@/types";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const {
      goal,
      plans,
      profile,
      today,
      observations,
      recentReflections,
      llm,
    }: {
      goal: Goal;
      plans: DailyPlan[];
      profile: LearningProfile | null;
      today: string;
      observations?: Observation[];
      recentReflections?: Array<{ date: string; what_i_learned: string; what_blocked_me: string; mood: string }>;
      llm?: LLMRequestSettings;
    } = await request.json();

    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(goal.deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    const totalRemainingTasks = plans
      .filter((p) => p.date >= today)
      .reduce((s, p) => s + p.tasks.length, 0);

    const totalRemainingMinutes = plans
      .filter((p) => p.date >= today)
      .reduce((s, p) => s + p.tasks.reduce((ts, t) => ts + (t.estimatedMinutes || 0), 0), 0);

    const dailyBudget = goal.dailyMinutes ?? 60;
    const totalBudget = daysLeft * dailyBudget;
    const overload = totalRemainingMinutes > totalBudget * 1.2;

    const materialsText =
      goal.materials && goal.materials.length > 0
        ? goal.materials.map((m) => m.name).join("、")
        : "未設定";

    const profileText = profile
      ? `平均達成率: ${Math.round(profile.averageCompletionRate)}%、難易度トレンド: ${profile.difficultyTrend}、総学習時間: ${Math.round(profile.totalStudyMinutes / 60)}時間`
      : "フィードバックデータなし";

    const observationsText = observations && observations.length > 0
      ? observations.map((o) => `- [${o.type}] ${o.content} (確信度: ${Math.round(o.confidence * 100)}%)`).join("\n")
      : "観測なし";

    const reflectionsText = recentReflections && recentReflections.length > 0
      ? recentReflections
          .slice(-3)
          .map((r) => `[${r.date}] 学び: ${r.what_i_learned} / 詰まり: ${r.what_blocked_me} / 気分: ${r.mood}`)
          .join("\n")
      : "";

    const prompt = `
あなたは学習コーチです。
以下のユーザーの学習状況を分析し、「短く、軽く、実行可能」なアドバイスを提供してください。
${languageInstruction(llm?.language)}

## 重要ルール
- 「あなたは○○」のような人格固定は禁止
- 観測・傾向に基づいた軽い提案として書く
- 実行できるかどうかを最優先に考える

## 目標
タイトル: ${goal.title}
現状: ${goal.current_state || "未設定"}
理想: ${goal.ideal_state || "未設定"}
ギャップ: ${goal.gap_summary || "未設定"}
期限まで: ${daysLeft}日
1日の学習時間: ${dailyBudget}分
登録教材: ${materialsText}

## 現在の学習状況
残りタスク数: ${totalRemainingTasks}件
残り推定学習時間: ${totalRemainingMinutes}分
利用可能な総学習時間: ${totalBudget}分
${overload ? "⚠️ 現在の計画は学習時間の予算を超過しています。" : "学習量は概ね適切です。"}

## 学習プロフィール
${profileText}

## 現在の観測
${observationsText}

${reflectionsText ? `## 直近の振り返り\n${reflectionsText}` : ""}

## 出力ルール
- 以下のJSON形式のみで返すこと（マークダウン不要）
- tipsは3〜4項目、各項目は1〜2文で簡潔に（観測・振り返りを根拠に）
- 数値を並べすぎないこと。行動に直結する短い表現にする
- 1項目は40字程度を目安に短くする
- recommendationsは登録教材以外のおすすめ教材・アプリ・サイト・学習法を2〜3件
- 過負荷の場合はペース調整・優先順位付けについてアドバイスすること

{
  "tips": [
    "具体的なアドバイス1",
    "具体的なアドバイス2",
    "具体的なアドバイス3"
  ],
  "recommendations": [
    { "name": "おすすめ教材・ツール名", "reason": "おすすめ理由（1文）" }
  ]
}
`.trim();

    const text = await callTextLLM(prompt, llm);
    const parsed = parseJsonText(text);

    return NextResponse.json({
      tips: parsed.tips ?? [],
      recommendations: parsed.recommendations ?? [],
    });
  } catch (e) {
    console.error("[learning-tips] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
