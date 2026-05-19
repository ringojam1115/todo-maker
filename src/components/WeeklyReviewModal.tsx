"use client";

import { useState } from "react";
import type { AppLanguage, Goal, Observation } from "@/types";
import { loadFeedbacks } from "@/lib/storage";

interface WeeklyReview {
  progressed: string[];
  struggled: string[];
  changed_observations: string[];
  gap_diff: string;
  next_week_policy: string;
  reduce_todos: string[];
  increase_todos: string[];
}

interface WeeklyReviewModalProps {
  goals: Goal[];
  observations: Observation[];
  language: AppLanguage;
  onClose: () => void;
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

export default function WeeklyReviewModal({
  goals,
  observations,
  language,
  onClose,
  llmPayload,
}: WeeklyReviewModalProps) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          llm: llmPayload(),
        }),
      });

      if (!res.ok) throw new Error(language === "ja" ? "生成に失敗しました" : "Generation failed");
      const data = await res.json();
      setReview(data);
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
        className="rounded-xl shadow-xl w-[600px] max-w-full mx-4 flex flex-col"
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
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-lg p-4 text-center" style={{ background: "#f9f9f7", border: "1px solid #e0e0da" }}>
                <p className="text-sm text-[var(--muted)] leading-relaxed max-w-sm">
                  {language === "ja"
                    ? "今週の振り返りをAIが整理します。断定ではなく観測・傾向として提示されます。"
                    : "AI will summarize your week as observations and tendencies, not judgments."}
                </p>
              </div>
              <button
                onClick={generateReview}
                className="rounded-full px-6 py-2.5 text-sm font-medium text-white"
                style={{ background: "#5c9e2e" }}
              >
                {language === "ja" ? "週次レビューを生成" : "Generate Weekly Review"}
              </button>
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
