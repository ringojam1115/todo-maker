"use client";

import { useState } from "react";
import type { AppLanguage, Goal, DailyPlansStore } from "@/types";

interface Props {
  date: string;
  goals: Goal[];
  plans: DailyPlansStore;
  language: AppLanguage;
  submitting: boolean;
  onSkip: () => void;
  onSubmit: (params: {
    completionRate: number;
    energyLevel: "low" | "medium" | "high";
    memo: string;
  }) => void;
}

const ENERGY_MAP: Record<number, "low" | "medium" | "high"> = {
  1: "low",
  2: "low",
  3: "medium",
  4: "high",
  5: "high",
};

export default function YesterdayFeedbackModal({
  date,
  goals,
  plans,
  language,
  submitting,
  onSkip,
  onSubmit,
}: Props) {
  const [completionRate, setCompletionRate] = useState(50);
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [memo, setMemo] = useState("");

  const d = new Date(date + "T00:00:00");
  const dateLabel =
    language === "ja"
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const relevantGoals = goals.filter((g) => plans[`${g.id}_${date}`]);

  const ENERGY_LABELS: Record<number, string> =
    language === "ja"
      ? { 1: "低め", 2: "やや低", 3: "普通", 4: "やや高", 5: "高い" }
      : { 1: "Very low", 2: "Low", 3: "Normal", 4: "High", 5: "Very high" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-xl flex flex-col mx-4"
        style={{ background: "#fff", border: "1px solid #e0e0da" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #e0e0da" }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
              {language === "ja" ? "昨日のフィードバック" : "Yesterday's Feedback"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>
              {language === "ja"
                ? `昨日（${dateLabel}）のフィードバックを入力してください`
                : `Please enter feedback for yesterday (${dateLabel})`}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Completion rate */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "#888" }}>
              {language === "ja" ? "完了率" : "Completion Rate"}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={completionRate}
                onChange={(e) => setCompletionRate(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
              <span
                className="text-sm font-semibold w-10 text-right tabular-nums"
                style={{ color: "#1a1a1a" }}
              >
                {completionRate}%
              </span>
            </div>
          </div>

          {/* Energy level */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "#888" }}>
              {language === "ja" ? "エネルギーレベル" : "Energy Level"}
            </label>
            <div className="flex gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setEnergyLevel(level)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium border transition-colors"
                  style={
                    energyLevel === level
                      ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                      : { background: "#fff", color: "#555", borderColor: "#e0e0da" }
                  }
                  title={ENERGY_LABELS[level]}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: "#aaa" }}>
              {ENERGY_LABELS[energyLevel]}
            </p>
          </div>

          {/* Memo */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "#888" }}>
              {language === "ja" ? "メモ（任意）" : "Notes (optional)"}
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={
                language === "ja" ? "昨日の状況を記録..." : "Notes about yesterday..."
              }
              className="w-full resize-none rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                border: "1px solid #e0e0da",
                color: "#1a1a1a",
                background: "#fafaf8",
              }}
              rows={3}
            />
          </div>

          {/* Affected goals */}
          {relevantGoals.length > 0 && (
            <p className="text-xs" style={{ color: "#aaa" }}>
              {language === "ja" ? "対象ゴール: " : "Goals: "}
              {relevantGoals.map((g) => g.title).join("、")}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid #e0e0da" }}
        >
          <button
            onClick={onSkip}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border transition-colors"
            style={{ borderColor: "#e0e0da", color: "#888", background: "#fff" }}
          >
            {language === "ja" ? "スキップ" : "Skip"}
          </button>
          <button
            onClick={() =>
              onSubmit({ completionRate, energyLevel: ENERGY_MAP[energyLevel], memo })
            }
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg font-medium transition-opacity"
            style={{ background: "var(--accent)", color: "#fff", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting
              ? language === "ja"
                ? "送信中..."
                : "Submitting..."
              : language === "ja"
              ? "送信"
              : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
