import { NextResponse } from "next/server";
import type { Material } from "@/types";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";

interface OtherGoal {
  title: string;
  dailyMinutes: number;
  daysLeft: number;
}

interface RecentReflection {
  date: string;
  what_i_learned: string;
  what_blocked_me: string;
  mood: string;
}

interface ObservationInput {
  type: string;
  content: string;
  confidence: number;
}

export async function POST(request: Request) {
  try {
    const {
      goalTitle,
      deadline,
      today,
      currentLevel,
      dailyMinutes,
      materials,
      calendarSlots,
      otherGoals,
      currentState,
      idealState,
      gapSummary,
      recentReflections,
      observations,
      llm,
    }: {
      goalTitle: string;
      deadline: string;
      today: string;
      currentLevel?: string;
      dailyMinutes?: number;
      materials?: Material[];
      calendarSlots?: Record<string, number>;
      otherGoals?: OtherGoal[];
      currentState?: string;
      idealState?: string;
      gapSummary?: string;
      recentReflections?: RecentReflection[];
      observations?: ObservationInput[];
      llm?: LLMRequestSettings;
    } = await request.json();

    const deadlineDate = new Date(deadline);
    const todayDate = new Date(today);
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const minsPerDay = dailyMinutes ?? 60;

    const materialsText =
      materials && materials.length > 0
        ? materials
            .map(
              (m) => `
    教材名: ${m.name}
    構成: ${m.structure}
    ${m.totalPages ? `総ページ数: ${m.totalPages}` : ""}
    ${m.features ? `特徴: ${m.features}` : ""}`
            )
            .join("\n")
        : "教材未指定。YouTube・問題サイト等の無料リソースを活用する前提で作成すること。";

    const calendarSection =
      calendarSlots && Object.keys(calendarSlots).length > 0
        ? `
## 各日の利用可能な学習時間（Googleカレンダーより）
${Object.entries(calendarSlots)
  .filter(([date]) => date >= today && date <= deadline)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, mins]) => {
    const budget = mins <= 30 ? "最低限(light)" : mins <= 90 ? "通常(medium)" : "余裕あり(deep可)";
    return `${date}: ${mins}分 → ${budget}`;
  })
  .join("\n")}
（記載のない日は1日${minsPerDay}分を想定）
`
        : "";

    const otherGoalsSection =
      otherGoals && otherGoals.length > 0
        ? `
## 他の学習目標
${otherGoals.map((g) => `- ${g.title}: 残り${g.daysLeft}日、1日${g.dailyMinutes}分`).join("\n")}
合計1日の学習時間目安: ${otherGoals.reduce((s, g) => s + g.dailyMinutes, 0) + minsPerDay}分
`
        : "";

    const gapSection =
      currentState || idealState || gapSummary
        ? `
## 現状・理想・ギャップ
現状: ${currentState || "未設定"}
理想: ${idealState || "未設定"}
ギャップ: ${gapSummary || "未設定"}
`
        : "";

    const reflectionsSection =
      recentReflections && recentReflections.length > 0
        ? `
## 直近の振り返り（実行可能なTODO設計に活用）
${recentReflections
  .slice(-3)
  .map(
    (r) =>
      `[${r.date}] 学び: ${r.what_i_learned} / 詰まり: ${r.what_blocked_me} / 気分: ${r.mood}`
  )
  .join("\n")}
`
        : "";

    const observationsSection =
      observations && observations.length > 0
        ? `
## 現在の観測（行動傾向・パターン）
${observations.map((o) => `- [${o.type}] ${o.content} (確信度: ${Math.round(o.confidence * 100)}%)`).join("\n")}
`
        : "";

    const prompt = `
あなたは学習計画の専門家です。
以下の情報をもとに、「理論上正しい」ではなく「その人が実行可能」なTODOプランを作成してください。
${languageInstruction(llm?.language)}

## 目標
タイトル: ${goalTitle}
期限: ${deadline}（残り${daysLeft}日）
現在のレベル: ${currentLevel || "未設定"}
1日の学習時間: ${minsPerDay}分
今日の日付: ${today}

## 使用教材
${materialsText}
${gapSection}
${reflectionsSection}
${observationsSection}
${calendarSection}
${otherGoalsSection}

## TODOの書き方ルール（必ず守ること）
- 「何を・どこまで・どのくらいの量」を必ず含める
  ✅ 良い例：「公式問題集Vol.2 Part3 Q41-52を解き、全問解説を読む」
  ❌ 悪い例：「リスニング問題を解く」
- 教材が指定されている場合は教材名・ページ数・問題番号・章名を含める
- ただし教材だけで全てをカバーしようとしないこと
- 1タスクは${Math.round(minsPerDay / 3)}〜${Math.round(minsPerDay / 2)}分で完了できる粒度にする
- 1日${Math.ceil(minsPerDay / 60)}〜${Math.ceil(minsPerDay / 60) + 1}タスクに絞る（詰め込みすぎない）
- estimatedMinutesは現実的な数値にする
- カレンダーで空き時間が少ない日はタスク数を減らし、energy_levelをlightにする
- 振り返りで詰まりが多い場合は短めのタスクを優先する
- 観測で傾向が分かる場合はそれを考慮する

## energy_levelの設定
- deep: 集中力が必要な作業（新規内容の学習、問題演習など）
- medium: 通常の作業（復習、練習など）
- light: 短時間・低負荷の作業（単語確認、軽い復習など）
- 重い予定がある日の後はlightを優先する
- 空き時間が30分以下の日はlightのみにする

## reasonの書き方
各タスクにreasonを1〜2文で付ける。観測・振り返りを根拠として使う。
例: 「最近30分以内のタスクの達成率が高いため」「先日復習が重いと記録されていたため」

## プランの粒度
- 今日から7日間は、毎日分のTODOを作る
- 8日目から3ヶ月後までは、週ごとのTODOを作る
- 3ヶ月より先は、月ごとのTODOを作る
- 今日のTODOだけは、各taskに detail を1〜2文で入れる

## 実現可能性チェック
- 期限内に達成できるか現実的に検討すること
- 達成が困難と思われる場合は最初のタスクの focus に「⚠️ 学習量が多い可能性があります」と記載すること

## 出力形式（JSONのみ・マークダウン不要）
[
  {
    "date": "YYYY-MM-DD",
    "focus": "その日のメインテーマ",
    "tasks": [
      {
        "id": "一意なuuid",
        "text": "具体的なタスクの説明",
        "estimatedMinutes": 45,
        "energy_level": "deep" | "medium" | "light",
        "reason": "このタスクを選んだ理由（観測・振り返りを根拠に）",
        "detail": "今日のTODOの場合のみ、具体的な進め方と完了条件"
      }
    ]
  }
]
`.trim();

    const text = await callTextLLM(prompt, llm);
    const plan = parseJsonText(text);
    return NextResponse.json(plan);
  } catch (e) {
    console.error("[generate-todos] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
