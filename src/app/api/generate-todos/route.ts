import { NextResponse } from "next/server";
import type { Material, TimeCommitment, LearningProfile, WeeklyReviewResult } from "@/types";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";

const COMMITMENT_MINUTES: Record<TimeCommitment, number> = {
  low: 30,
  medium: 60,
  high: 120,
  very_high: 180,
};

const COMMITMENT_LABEL: Record<TimeCommitment, string> = {
  low: "少なめ（目安30分/日）",
  medium: "普通（目安1時間/日）",
  high: "多め（目安2時間/日）",
  very_high: "集中的（目安3時間以上/日）",
};

interface OtherGoal {
  title: string;
  timeCommitment?: TimeCommitment;
  dailyMinutes?: number;
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

interface FeedbackInput {
  date: string;
  energyLevel: 'low' | 'medium' | 'high';
  overallNote: string;
}

interface SkillMemoInput {
  goalTitle: string;
  skills: string;
}

interface LearningLogInput {
  date: string;
  content: string;
}

export async function POST(request: Request) {
  try {
    const {
      goalTitle,
      deadline,
      today,
      timeCommitment,
      scheduleNote,
      materials,
      calendarSlots,
      otherGoals,
      currentState,
      idealState,
      gapSummary,
      recentReflections,
      observations,
      learningProfile,
      weeklyReview,
      recentFeedbacks,
      acquiredSkills,
      recentLearningLogs,
      llm,
    }: {
      goalTitle: string;
      deadline: string;
      today: string;
      timeCommitment?: TimeCommitment;
      scheduleNote?: string;
      materials?: Material[];
      calendarSlots?: Record<string, number>;
      otherGoals?: OtherGoal[];
      currentState?: string;
      idealState?: string;
      gapSummary?: string;
      recentReflections?: RecentReflection[];
      observations?: ObservationInput[];
      learningProfile?: LearningProfile;
      weeklyReview?: Pick<WeeklyReviewResult, 'next_week_policy' | 'reduce_todos' | 'increase_todos' | 'goal_perception' | 'weekStart'>;
      recentFeedbacks?: FeedbackInput[];
      acquiredSkills?: SkillMemoInput[];
      recentLearningLogs?: LearningLogInput[];
      llm?: LLMRequestSettings;
    } = await request.json();

    const deadlineDate = new Date(deadline);
    const todayDate = new Date(today);
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const commitment = timeCommitment ?? "medium";
    const minsPerDay = COMMITMENT_MINUTES[commitment];

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
（記載のない日は目安${minsPerDay}分を想定）
`
        : "";

    const otherGoalsSection =
      otherGoals && otherGoals.length > 0
        ? `
## 他の学習目標
${otherGoals.map((g) => {
  const mins = g.timeCommitment ? COMMITMENT_MINUTES[g.timeCommitment] : (g.dailyMinutes ?? 60);
  return `- ${g.title}: 残り${g.daysLeft}日、時間のかけ方目安: ${mins}分/日`;
}).join("\n")}
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

    const scheduleNoteSection = scheduleNote
      ? `
## ユーザーからの要望（必ず守ること）
${scheduleNote}

▶ スケジュール解釈の例：
- 「○月○日から本格的にやりたい」→ それ以前の日付はタスクを最小限（1件以下）またはスキップし、指定日以降から通常のプランを開始する
- 「○日までは最小限で」→ その期間はlight・1タスク/日以下にする
- 「○日まで別の目標に集中」→ その間このゴールのタスクはゼロにしてよい
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

    const energyTrendSection =
      recentFeedbacks && recentFeedbacks.length > 0
        ? `
## 最近のエネルギー傾向（直近${recentFeedbacks.length}日）
${recentFeedbacks
  .map((f) => {
    const label = f.energyLevel === "high" ? "高" : f.energyLevel === "medium" ? "中" : "低";
    return `- ${f.date}: エネルギー=${label}${f.overallNote ? `、メモ: ${f.overallNote}` : ""}`;
  })
  .join("\n")}
`
        : "";

    const acquiredSkillsSection =
      acquiredSkills && acquiredSkills.length > 0
        ? `
## 習得済みスキル（これと重複するタスクは生成しないこと）
${acquiredSkills.map((s) => `- [${s.goalTitle}] ${s.skills}`).join("\n")}
`
        : "";

    const learningLogsSection =
      recentLearningLogs && recentLearningLogs.length > 0
        ? `
## 最近の学習メモ（直近${recentLearningLogs.length}件）
${recentLearningLogs.map((l) => `- [${l.date}] ${l.content}`).join("\n")}
`
        : "";

    // averageTimeRatio: if > 1.1, scale up estimatedMinutes
    const timeRatio = learningProfile?.averageTimeRatio ?? 1;
    const timeRatioNote =
      timeRatio > 1.1
        ? `
## 実績ベースの時間補正（重要）
過去の実績から、このユーザーは予定時間より平均${Math.round((timeRatio - 1) * 100)}%多くかかる傾向があります。
estimatedMinutesはすべて×${timeRatio.toFixed(2)}で計算してから設定してください。
例：「30分」と書きたい場合は実際に${Math.round(30 * timeRatio)}分と設定する。
`
        : timeRatio < 0.9
        ? `
## 実績ベースの時間補正
過去の実績から、このユーザーは予定より平均${Math.round((1 - timeRatio) * 100)}%早く完了する傾向があります。
estimatedMinutesはやや短めに設定しても問題ありません。
`
        : "";

    const profileSection = learningProfile && learningProfile.totalStudyMinutes > 0
      ? `
## 学習プロフィール（過去の実績）
平均達成率: ${Math.round(learningProfile.averageCompletionRate)}%
難易度トレンド: ${learningProfile.difficultyTrend}（improving=向上中 / stable=安定 / struggling=苦戦中）
総学習時間: ${Math.round(learningProfile.totalStudyMinutes / 60)}時間${
  learningProfile.materialAffinities.length > 0
    ? `\n教材との相性:\n${learningProfile.materialAffinities
        .map((m) => `  - ${m.materialName}: 達成率${Math.round(m.completionRate)}%、難易度平均${m.difficultyAverage.toFixed(1)}`)
        .join("\n")}`
    : ""
}
`
      : "";

    const weeklyReviewSection = weeklyReview
      ? `
## 前回の週次レビュー（${weeklyReview.weekStart}週）からの引き継ぎ
来週の方針: ${weeklyReview.next_week_policy}
${weeklyReview.reduce_todos.length > 0 ? `削るべきTODOの傾向: ${weeklyReview.reduce_todos.join("、")}` : ""}
${weeklyReview.increase_todos.length > 0 ? `増やすべきTODOの傾向: ${weeklyReview.increase_todos.join("、")}` : ""}
${
  weeklyReview.goal_perception && weeklyReview.goal_perception.length > 0
    ? `目標認識の予測:\n${weeklyReview.goal_perception
        .map(
          (p) =>
            `  - ${p.goalTitle}: ${p.perceived_direction}（モチベーション: ${p.motivation_signal}${p.possible_drift ? `、変化の兆候: ${p.possible_drift}` : ""}）`
        )
        .join("\n")}`
    : ""
}
`
      : "";

    const prompt = `
あなたは学習計画の専門家です。
以下の情報をもとに、「理論上正しい」ではなく「その人が実行可能」なTODOプランを作成してください。
${languageInstruction(llm?.language)}

## 目標
タイトル: ${goalTitle}
期限: ${deadline}（残り${daysLeft}日）
時間のかけ方: ${COMMITMENT_LABEL[commitment]}
今日の日付: ${today}

※「時間のかけ方」はユーザーの意向の目安であり、厳密な制約ではありません。
　日々の振り返り・観測・カレンダー・体調などを優先し、柔軟に調整してください。

## 使用教材
${materialsText}
${scheduleNoteSection}
${gapSection}
${timeRatioNote}
${profileSection}
${weeklyReviewSection}
${reflectionsSection}
${observationsSection}
${energyTrendSection}
${acquiredSkillsSection}
${learningLogsSection}
${calendarSection}
${otherGoalsSection}

## TODOの書き方ルール（必ず守ること）
- 「何を・どこまで・どのくらいの量」を必ず含める
  ✅ 良い例：「公式問題集Vol.2 Part3 Q41-52を解き、全問解説を読む」
  ❌ 悪い例：「リスニング問題を解く」
- 教材が指定されている場合は教材名・ページ数・問題番号・章名を含める
- 1タスクは${Math.round(minsPerDay / 3)}〜${Math.round(minsPerDay / 2)}分で完了できる粒度にする（あくまで目安）
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
各タスクにreasonを1〜2文で付ける。観測・振り返り・ユーザーの要望を根拠として使う。
例: 「最近30分以内のタスクの達成率が高いため」「ユーザーの要望により本格始動前の準備タスク」

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
        "reason": "このタスクを選んだ理由（観測・振り返り・ユーザー要望を根拠に）",
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
