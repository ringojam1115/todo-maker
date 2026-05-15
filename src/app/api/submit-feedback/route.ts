import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";
import type { Goal, TaskFeedback, DailyPlan, LearningProfile, MaterialAffinity } from "@/types";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const {
      goal,
      date,
      taskFeedbacks,
      overallNote,
      energyLevel,
      remainingDays,
      currentPlans,
      profile,
    }: {
      goal: Goal;
      date: string;
      taskFeedbacks: TaskFeedback[];
      overallNote: string;
      energyLevel: "low" | "medium" | "high";
      remainingDays: number;
      currentPlans: DailyPlan[];
      profile: LearningProfile;
    } = await request.json();

    // --- Profile update (server-side) ---
    const alpha = 0.3;
    const totalActual = taskFeedbacks.reduce((s, t) => s + t.actualMinutes, 0);
    const totalEstimated = taskFeedbacks.reduce((s, t) => s + t.estimatedMinutes, 0);
    const sessionTimeRatio = totalEstimated > 0 ? totalActual / totalEstimated : 1;
    const sessionCompletion =
      taskFeedbacks.reduce((s, t) => s + t.completionRate, 0) / taskFeedbacks.length;

    const newCompletionRate =
      profile.totalStudyMinutes === 0
        ? sessionCompletion
        : profile.averageCompletionRate * (1 - alpha) + sessionCompletion * alpha;

    const newTimeRatio =
      profile.totalStudyMinutes === 0
        ? sessionTimeRatio
        : profile.averageTimeRatio * (1 - alpha) + sessionTimeRatio * alpha;

    const updatedAffinities: MaterialAffinity[] = [...profile.materialAffinities];
    const diffMap: Record<string, number> = { easy: 1, just_right: 2, hard: 3 };
    for (const tf of taskFeedbacks) {
      if (!tf.materialName) continue;
      const existing = updatedAffinities.find((a) => a.materialName === tf.materialName);
      const diffNum = diffMap[tf.difficulty];
      if (existing) {
        existing.completionRate =
          existing.completionRate * (1 - alpha) + tf.completionRate * alpha;
        existing.difficultyAverage =
          existing.difficultyAverage * (1 - alpha) + diffNum * alpha;
        existing.totalMinutes += tf.actualMinutes;
        existing.sessionCount += 1;
      } else {
        updatedAffinities.push({
          materialName: tf.materialName,
          completionRate: tf.completionRate,
          difficultyAverage: diffNum,
          totalMinutes: tf.actualMinutes,
          sessionCount: 1,
        });
      }
    }

    const avgDiff =
      taskFeedbacks.reduce((s, t) => s + diffMap[t.difficulty], 0) / taskFeedbacks.length;
    let difficultyTrend = profile.difficultyTrend;
    if (sessionCompletion > 80 && avgDiff < 1.5) difficultyTrend = "improving";
    else if (sessionCompletion < 50 || avgDiff > 2.5) difficultyTrend = "struggling";
    else difficultyTrend = "stable";

    const updatedProfile: LearningProfile = {
      goalId: goal.id,
      averageCompletionRate: newCompletionRate,
      averageTimeRatio: newTimeRatio,
      materialAffinities: updatedAffinities,
      difficultyTrend,
      totalStudyMinutes: profile.totalStudyMinutes + totalActual,
      updatedAt: new Date().toISOString(),
    };

    // --- Build prompt for plan optimization ---
    const prompt = `
あなたは学習コーチです。
ユーザーの今日のフィードバックを分析し、
明日以降のTODOプランを最適化してください。

## 目標
${goal.title}（残り${remainingDays}日）

## 今日（${date}）のフィードバック
${taskFeedbacks
  .map(
    (t) => `
・タスク: ${t.taskText}
  達成度: ${t.completionRate}%
  時間: 予定${t.estimatedMinutes}分 → 実際${t.actualMinutes}分
  難易度: ${t.difficulty}
  ${t.materialName ? `教材: ${t.materialName}` : ""}`
  )
  .join("")}
コンディション: ${energyLevel}
今日のメモ: ${overallNote || "なし"}

## ユーザーの学習プロフィール（過去の傾向）
平均達成率: ${Math.round(updatedProfile.averageCompletionRate)}%
時間の読み: 予定より平均${Math.round((updatedProfile.averageTimeRatio - 1) * 100)}%多くかかる傾向
教材との相性:
${
  updatedProfile.materialAffinities
    .map(
      (m) =>
        `・${m.materialName}: 達成率${Math.round(m.completionRate)}%、難易度平均${m.difficultyAverage.toFixed(1)}`
    )
    .join("\n") || "データなし"
}

## 最適化のルール
- 達成率が60%以下のタスクは翌日に持ち越すか、分割して小さくする
- 実際の時間が予定より常に長い場合は、estimatedMinutesを実績ベースに修正する
- 難しいと評価された教材のタスクは量を減らす
- コンディションが低い日が続く場合は全体のタスク量を減らす
- 達成率が高く「簡単」と評価した場合は難易度を上げるかタスク量を増やす
- 未完了タスクは翌日以降に組み込む

## 現在の翌日以降のプラン
${JSON.stringify(currentPlans, null, 2)}

## 出力（JSONのみ・マークダウン不要）
{
  "updatedPlans": [
    {
      "date": "YYYY-MM-DD",
      "focus": "その日のテーマ",
      "tasks": [
        {
          "id": "uuid",
          "text": "具体的なタスク",
          "estimatedMinutes": 45
        }
      ]
    }
  ],
  "coachComment": "ユーザーへの短いフィードバックコメント（日本語・2〜3文）"
}
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
    const text: string = data.choices[0].message.content;
    const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      updatedPlans: parsed.updatedPlans,
      updatedProfile,
      coachComment: parsed.coachComment,
    });
  } catch (e) {
    console.error("[submit-feedback] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
