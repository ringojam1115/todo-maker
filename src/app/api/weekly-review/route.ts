import { NextResponse } from "next/server";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";
import type { Observation } from "@/types";

interface TaskFeedbackInput {
  taskText: string
  completed: boolean
  difficulty: string
  reflection?: string
}

interface DailyFeedbackInput {
  date: string
  goalId: string
  taskFeedbacks: TaskFeedbackInput[]
  overallNote: string
  energyLevel: string
}

interface GoalInput {
  id: string
  title: string
  current_state?: string
  ideal_state?: string
  gap_summary?: string
  deadline: string
}

interface ReflectionInput {
  goal_id: string
  date: string
  what_i_did: string
  what_i_learned: string
  what_blocked_me: string
  mood: string
  next_action: string
}

export async function POST(request: Request) {
  try {
    const {
      goals,
      feedbacks,
      observations,
      reflections,
      weekStart,
      weekEnd,
      llm,
    }: {
      goals: GoalInput[]
      feedbacks: DailyFeedbackInput[]
      observations: Observation[]
      reflections?: ReflectionInput[]
      weekStart: string
      weekEnd: string
      llm?: LLMRequestSettings
    } = await request.json();

    const goalsText = goals
      .map(
        (g) =>
          `目標: ${g.title}
  現状: ${g.current_state || "未設定"}
  理想: ${g.ideal_state || "未設定"}
  ギャップ: ${g.gap_summary || "未設定"}
  期限: ${g.deadline}`
      )
      .join("\n\n");

    const feedbacksText = feedbacks.length > 0
      ? feedbacks
          .map(
            (f) =>
              `[${f.date}] エネルギー: ${f.energyLevel}\n${f.taskFeedbacks
                .map(
                  (t) =>
                    `  - ${t.taskText} (${t.completed ? "完了" : "未完了"}, 難易度: ${t.difficulty})${t.reflection ? ` → ${t.reflection}` : ""}`
                )
                .join("\n")}${f.overallNote ? `\n  メモ: ${f.overallNote}` : ""}`
          )
          .join("\n\n")
      : "今週の記録なし";

    const observationsText = observations.length > 0
      ? observations.map((o) => `- [${o.type}] ${o.content} (確信度: ${Math.round(o.confidence * 100)}%)`).join("\n")
      : "観測なし";

    const reflectionsText = reflections && reflections.length > 0
      ? reflections
          .map(
            (r) =>
              `[${r.date}][目標:${goals.find((g) => g.id === r.goal_id)?.title ?? r.goal_id}] ` +
              `やったこと: ${r.what_i_did || "-"} / ` +
              `学び: ${r.what_i_learned || "-"} / ` +
              `詰まり: ${r.what_blocked_me || "-"} / ` +
              `気分: ${r.mood || "-"} / ` +
              `次のアクション: ${r.next_action || "-"}`
          )
          .join("\n")
      : "振り返り記録なし";

    const goalIds = goals.map((g) => g.id).join('", "');

    const prompt = `
あなたは週次レビューを生成するアシスタントです。
${languageInstruction(llm?.language)}

## 重要ルール
- 「あなたは○○です」のような人格固定は禁止
- 「今週○○の傾向がありました」「最近○○が観測されています」のように観測・仮説として表現する
- 断定ではなく、ユーザーが自己理解を深めるための鏡として機能する
- 来週の提案は押しつけではなく軽い提案として書く
- 目標認識の予測は「かもしれない」「可能性があります」などの表現を使う。ユーザーの突発的な発言や入力を鵜呑みにしない

## レビュー期間
${weekStart} 〜 ${weekEnd}

## 目標・現状・理想・ギャップ
${goalsText}

## 今週の実績（フィードバックログ）
${feedbacksText}

## 今週の振り返り（Reflection）
${reflectionsText}

## 現在の観測
${observationsText}

## 目標認識の分析について
振り返りの内容（what_i_learned, what_blocked_me, mood, next_action）とフィードバックのパターンから、
ユーザーが目標に対して実際にどのような認識・気持ちを持っているかを仮説として予測してください。

注意点：
- ユーザーが最初に入力した目標（current_state / ideal_state）と、実際の行動・振り返りの間にズレがあるかを観察する
- 目標が変化・進化している可能性もあり、それは悪いことではない
- 抽象的な目標の場合、ユーザー自身がまだ言語化できていない可能性がある
- 「突発的な思いつき」と「継続的な関心」を区別して評価する
- confidence は行動・振り返りの証拠の量と一貫性から判断する（証拠が少なければ低く）

## 出力形式（JSONのみ）
{
  "progressed": ["今週進んだこと（観測・事実として）"],
  "struggled": ["今週詰まったこと（断定せず傾向として）"],
  "changed_observations": ["変化した観測（あれば）"],
  "gap_diff": "理想との差分（現在の状況を客観的に）",
  "next_week_policy": "来週の方針（軽い提案として）",
  "reduce_todos": ["削るべきTODOの傾向・種類"],
  "increase_todos": ["増やすべきTODOの傾向・種類"],
  "goal_perception": [
    {
      "goalId": "目標のID（必ず以下のいずれか: "${goalIds}"）",
      "goalTitle": "目標のタイトル",
      "perceived_direction": "ユーザーが実際に向かっている方向の仮説（振り返りの内容から推測）",
      "motivation_signal": "high | medium | low | shifting（モチベーションの状態の判断）",
      "possible_drift": "目標がズレている可能性や変化の兆候（なければ省略）",
      "confidence": 0.0〜1.0（振り返りの証拠の量・一貫性から判断）
    }
  ]
}
`.trim();

    const text = await callTextLLM(prompt, llm);
    const review = parseJsonText(text);
    return NextResponse.json(review);
  } catch (e) {
    console.error("[weekly-review] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
