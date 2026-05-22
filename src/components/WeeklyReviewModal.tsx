"use client";

import { useState } from "react";
import type { AppLanguage, Goal, Observation, WeeklyReviewResult } from "@/types";
import { loadFeedbacks, loadReflections } from "@/lib/storage";

interface WeeklyReviewModalProps {
  goals: Goal[];
  observations: Observation[];
  language: AppLanguage;
  onClose: () => void;
  onSave: (review: WeeklyReviewResult) => void;
  llmPayload: () => { provider: string; apiKey?: string; language: AppLanguage };
}

function Spinner({ size = "w-4 h-4" }: { size?: string }) {
  return (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color }}>
        {title}
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--text)]">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MOTIVATION_LABEL: Record<string, { ja: string; color: string }> = {
  high:     { ja: "高い",     color: "#5c9e2e" },
  medium:   { ja: "普通",     color: "#888" },
  low:      { ja: "低め",     color: "#b45309" },
  shifting: { ja: "変化中",   color: "#7c3aed" },
};

export default function WeeklyReviewModal({
  goals,
  observations,
  language,
  onClose,
  onSave,
  llmPayload,
}: WeeklyReviewModalProps) {
  const [review, setReview] = useState<WeeklyReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalChanged, setGoalChanged] = useState<'same' | 'slightly' | 'significantly'>('same');
  const [motivationScore, setMotivationScore] = useState(5);
  const [changeReason, setChangeReason] = useState('');

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr = today.toISOString().split("T")[0];

  async function generateReview() {
    setLoading(true);
    setError(null);
    try {
      const allFeedbacks = loadFeedbacks();
      const weekFeedbacks = allFeedbacks.filter(
        (f) => f.date >= weekStartStr && f.date <= weekEndStr
      );

      const allReflections = loadReflections();
      const weekReflections = allReflections
        .filter((r) => r.date >= weekStartStr && r.date <= weekEndStr)
        .map((r) => ({
          goal_id: r.goal_id,
          date: r.date,
          what_i_did: r.what_i_did,
          what_i_learned: r.what_i_learned,
          what_blocked_me: r.what_blocked_me,
          mood: r.mood,
          next_action: r.next_action,
        }));

      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: goals.map((g) => ({
            id: g.id,
            title: g.title,
            current_state: g.current_state,
            ideal_state: g.ideal_state,
            gap_summary: g.gap_summary,
            deadline: g.deadline,
          })),
          feedbacks: weekFeedbacks,
          observations,
          reflections: weekReflections.length > 0 ? weekReflections : undefined,
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          llm: llmPayload(),
        }),
      });

      if (!res.ok) throw new Error(language === "ja" ? "生成に失敗しました" : "Generation failed");
      const data = await res.json();
      const result: WeeklyReviewResult = {
        ...data,
        goal_perception: data.goal_perception ?? [],
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        createdAt: new Date().toISOString(),
        goalChanged,
        motivationScore,
        changeReason: changeReason.trim() || undefined,
        timestamp: new Date().toISOString(),
      };
      setReview(result);
      onSave(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : language === "ja" ? "エラーが発生しました" : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (d: Date) =>
    d.toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <div
        className="rounded-xl shadow-xl w-[620px] max-w-full mx-4 flex flex-col"
        style={{ background: "#fff", border: "1px solid #e0e0da", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #e0e0da" }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
              {language === "ja" ? "週次レビュー" : "Weekly Review"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>
              {formatDate(weekStart)} — {formatDate(today)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none rounded hover:bg-gray-100 w-7 h-7 flex items-center justify-center"
            style={{ color: "#888" }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!review && !loading && (
            <div className="flex flex-col gap-5 py-2">
              {/* Q1: Goal change */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                  {language === "ja" ? "今の目標はまだ同じですか？" : "Is your goal still the same?"}
                </p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "same",          labelJa: "変わっていない",   labelEn: "Unchanged" },
                      { value: "slightly",      labelJa: "少し変わった",     labelEn: "Slightly changed" },
                      { value: "significantly", labelJa: "大きく変わった",   labelEn: "Significantly changed" },
                    ] as const
                  ).map(({ value, labelJa, labelEn }) => (
                    <button
                      key={value}
                      onClick={() => setGoalChanged(value)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                      style={
                        goalChanged === value
                          ? { background: "#eef7e6", border: "1px solid #5c9e2e", color: "#3d6e1a" }
                          : { background: "#f9f9f7", border: "1px solid #e0e0da", color: "#555" }
                      }
                    >
                      {language === "ja" ? labelJa : labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2: Motivation slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                    {language === "ja" ? "今週のモチベーションはどうでしたか？" : "How was your motivation this week?"}
                  </p>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "#5c9e2e" }}>
                    {motivationScore} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={motivationScore}
                  onChange={(e) => setMotivationScore(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "#5c9e2e" }}
                />
                <div className="flex justify-between text-[10px]" style={{ color: "#aaa" }}>
                  <span>{language === "ja" ? "低い" : "Low"}</span>
                  <span>{language === "ja" ? "高い" : "High"}</span>
                </div>
              </div>

              {/* Q3: Change reason (conditional) */}
              {goalChanged !== "same" && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                    {language === "ja"
                      ? "目標や気持ちが変わった場合、理由を教えてください"
                      : "If your goal or feelings changed, what was the reason?"}
                    <span className="ml-1 text-xs font-normal" style={{ color: "#aaa" }}>
                      {language === "ja" ? "（任意）" : "(optional)"}
                    </span>
                  </p>
                  <textarea
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder={language === "ja" ? "例：優先度が変わった、新しい興味が生まれたなど" : "e.g. priorities shifted, new interest emerged..."}
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                    style={{ background: "#f9f9f7", border: "1px solid #e0e0da", color: "#1a1a1a" }}
                  />
                </div>
              )}

              <div className="rounded-lg p-3" style={{ background: "#f9f9f7", border: "1px solid #e0e0da" }}>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {language === "ja"
                    ? "今週の振り返りをAIが整理します。断定ではなく観測・傾向として提示されます。目標に対する認識の変化も含めます。"
                    : "AI will summarize your week as observations and tendencies, including shifts in how you perceive your goals."}
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={generateReview}
                  className="rounded-full px-6 py-2.5 text-sm font-medium text-white"
                  style={{ background: "#5c9e2e" }}
                >
                  {language === "ja" ? "週次レビューを生成" : "Generate Weekly Review"}
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Spinner size="w-6 h-6" />
              <p className="text-sm text-[var(--muted)]">
                {language === "ja" ? "今週を分析中..." : "Analyzing your week..."}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#fff0f0", color: "#b91c1c", border: "1px solid #fca5a5" }}>
              {error}
            </div>
          )}

          {review && (
            <div className="flex flex-col gap-5">
              <Section
                title={language === "ja" ? "今週進んだこと" : "What progressed"}
                items={review.progressed}
                color="#5c9e2e"
              />
              <Section
                title={language === "ja" ? "今週詰まったこと" : "What you struggled with"}
                items={review.struggled}
                color="#b45309"
              />
              {review.changed_observations && review.changed_observations.length > 0 && (
                <Section
                  title={language === "ja" ? "変化した観測" : "Shifted observations"}
                  items={review.changed_observations}
                  color="#7c3aed"
                />
              )}

              {review.gap_diff && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: "#0369a1" }}>
                    {language === "ja" ? "理想との差分" : "Gap from ideal"}
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--text)] rounded-md bg-[var(--panel)] px-4 py-3">
                    {review.gap_diff}
                  </p>
                </div>
              )}

              {/* Goal Perception Section */}
              {review.goal_perception && review.goal_perception.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: "#888" }}>
                    {language === "ja" ? "目標に対する認識の予測" : "Perceived goal alignment"}
                  </p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "#aaa" }}>
                    {language === "ja"
                      ? "振り返りの内容からAIが読み取った傾向です。あくまで仮説であり、決めつけではありません。"
                      : "AI-inferred tendencies from your reflections — hypotheses, not conclusions."}
                  </p>
                  <div className="flex flex-col gap-3 mt-1">
                    {review.goal_perception.map((p) => {
                      const motiv = MOTIVATION_LABEL[p.motivation_signal] ?? { ja: p.motivation_signal, color: "#888" };
                      const goal = goals.find((g) => g.id === p.goalId);
                      return (
                        <div
                          key={p.goalId}
                          className="rounded-lg px-4 py-3 flex flex-col gap-1.5"
                          style={{ background: "#f9f9f7", border: "1px solid #e0e0da" }}
                        >
                          <div className="flex items-center gap-2">
                            {goal && (
                              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: goal.color }} />
                            )}
                            <p className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>{p.goalTitle}</p>
                            <span
                              className="ml-auto text-[10px] rounded-full px-2 py-0.5 font-medium"
                              style={{ background: motiv.color + "22", color: motiv.color, border: `1px solid ${motiv.color}44` }}
                            >
                              {language === "ja" ? `モチベ: ${motiv.ja}` : `Motivation: ${p.motivation_signal}`}
                            </span>
                            <span className="text-[10px]" style={{ color: "#bbb" }}>
                              {language === "ja" ? `確信度: ${Math.round(p.confidence * 100)}%` : `${Math.round(p.confidence * 100)}% confidence`}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "#555" }}>
                            {p.perceived_direction}
                          </p>
                          {p.possible_drift && (
                            <p className="text-[11px] leading-relaxed rounded px-2 py-1" style={{ color: "#7c3aed", background: "#f5f0ff", border: "1px solid #e4d9ff" }}>
                              {language === "ja" ? "変化の兆候: " : "Possible drift: "}{p.possible_drift}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {review.next_week_policy && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: "#5c9e2e" }}>
                    {language === "ja" ? "来週の方針（提案）" : "Next week's direction"}
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--text)] rounded-md" style={{ background: "#f0f7e8", padding: "12px 16px", border: "1px solid #c3e0a0" }}>
                    {review.next_week_policy}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Section
                  title={language === "ja" ? "削るべきTODO" : "TODOs to reduce"}
                  items={review.reduce_todos}
                  color="#888"
                />
                <Section
                  title={language === "ja" ? "増やすべきTODO" : "TODOs to increase"}
                  items={review.increase_todos}
                  color="#5c9e2e"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid #e0e0da" }}
        >
          <p className="text-[11px] text-[var(--muted)]">
            {language === "ja" ? "観測ベースの提案です。最終判断はあなたが行います。" : "Observation-based suggestions. You make the final call."}
          </p>
          <div className="flex gap-2">
            {review && (
              <button
                onClick={generateReview}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
              >
                {language === "ja" ? "再生成" : "Regenerate"}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
            >
              {language === "ja" ? "閉じる" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
