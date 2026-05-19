import { NextResponse } from "next/server";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";
import type { Observation } from "@/types";

interface ReflectionInput {
  task_id: string
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
      reflections,
      existingObservations,
      goalTitle,
      llm,
    }: {
      reflections: ReflectionInput[]
      existingObservations: Observation[]
      goalTitle: string
      llm?: LLMRequestSettings
    } = await request.json();

    if (!reflections || reflections.length === 0) {
      return NextResponse.json({ observations: existingObservations ?? [] });
    }

    const reflectionsText = reflections
      .map(
        (r) =>
          `[${r.date}] やったこと: ${r.what_i_did} / 学んだこと: ${r.what_i_learned} / 詰まったこと: ${r.what_blocked_me} / 気分: ${r.mood}`
      )
      .join("\n");

    const existingText =
      existingObservations.length > 0
        ? `\n## 既存の観測\n${existingObservations.map((o) => `- [${o.type}] ${o.content} (確信度: ${o.confidence})`).join("\n")}`
        : "";

    const prompt = `
あなたは学習観察システムです。ユーザーの振り返りログから「観測（Observation）」を生成してください。
${languageInstruction(llm?.language)}

## 重要ルール
- 「あなたは○○な人です」「あなたは○○タイプです」のような固定人格化は禁止
- 「最近、○○への関心が観測されています」「最近、○○で詰まりやすい傾向があります」のように、観測・仮説として表現する
- 観測は短期的なパターンに基づく。断定ではなく観測として扱う
- 既存の観測と重複する場合は新規生成せず、confidence を上げることを示す更新情報を返す

## 目標
${goalTitle}

## 振り返りログ（直近）
${reflectionsText}
${existingText}

## 出力形式（JSONのみ）
{
  "new_observations": [
    {
      "type": "tendency" | "interest" | "pattern" | "struggle",
      "content": "最近、○○の傾向が観測されています",
      "confidence": 0.6,
      "evidence_log_ids": ["task_id_1"]
    }
  ],
  "update_ids": ["existing_observation_id_to_reinforce"]
}

typeの意味:
- tendency: 行動傾向（「短時間タスクの達成率が高い」など）
- interest: 関心・興味の傾向
- pattern: 学習パターン（「朝の方が集中できる」など）
- struggle: 詰まりやすいポイント
`.trim();

    const text = await callTextLLM(prompt, llm);
    const result = parseJsonText(text) as {
      new_observations?: Array<{
        type: string
        content: string
        confidence: number
        evidence_log_ids: string[]
      }>
      update_ids?: string[]
    };

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const newObs: Observation[] = (result.new_observations ?? []).map((o) => ({
      id: crypto.randomUUID(),
      type: o.type as Observation["type"],
      content: o.content,
      confidence: Math.min(1, Math.max(0, o.confidence)),
      evidence_log_ids: o.evidence_log_ids ?? [],
      created_at: now,
      last_seen_at: now,
      expires_at: expiresAt,
    }));

    const updatedExisting = existingObservations.map((obs) => {
      if ((result.update_ids ?? []).includes(obs.id)) {
        return {
          ...obs,
          confidence: Math.min(1, obs.confidence + 0.1),
          last_seen_at: now,
          expires_at: expiresAt,
        };
      }
      return obs;
    });

    const allObservations = [...updatedExisting, ...newObs].filter(
      (obs) => new Date(obs.expires_at) > new Date()
    );

    return NextResponse.json({ observations: allObservations });
  } catch (e) {
    console.error("[generate-observations] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
