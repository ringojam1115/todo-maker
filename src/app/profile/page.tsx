"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LearningProfile, DailyFeedback } from "@/types";
import { loadFeedbacks, loadProfiles } from "@/lib/storage";

function ProfileContent() {
  const searchParams = useSearchParams();
  const goalId = searchParams.get("goalId");

  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [feedbacks, setFeedbacks] = useState<DailyFeedback[]>([]);
  const [aiComment, setAiComment] = useState("");
  const [loadingComment, setLoadingComment] = useState(false);

  useEffect(() => {
    const profiles = loadProfiles();
    const allFeedbacks = loadFeedbacks();

    if (goalId) {
      const p = profiles[goalId] ?? null;
      setProfile(p);
      setFeedbacks(allFeedbacks.filter((f) => f.goalId === goalId));
    }
  }, [goalId]);

  useEffect(() => {
    if (!profile) return;
    setLoadingComment(true);
    fetch("/api/learning-comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    })
      .then((r) => r.json())
      .then((data) => setAiComment(data.comment ?? ""))
      .catch(() => setAiComment("コメントの取得に失敗しました"))
      .finally(() => setLoadingComment(false));
  }, [profile]);

  // Build 7-day chart data (last 7 days)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const date = d.toISOString().split("T")[0];
    const feedback = feedbacks.find((f) => f.date === date);
    const rate = feedback
      ? Math.round(
          feedback.taskFeedbacks.reduce((s, t) => s + t.completionRate, 0) /
            feedback.taskFeedbacks.length
        )
      : null;
    return { date: date.slice(5).replace("-", "/"), rate };
  });

  if (!goalId || !profile) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-3"
        style={{ background: "#f2f2ef" }}
      >
        <p className="text-sm" style={{ color: "#888" }}>
          プロフィールデータがありません
        </p>
        <p className="text-xs" style={{ color: "#aaa" }}>
          フィードバックを送信すると、学習プロフィールが蓄積されます。
        </p>
        <Link
          href="/"
          className="text-sm font-medium mt-2"
          style={{ color: "#5c9e2e" }}
        >
          ← ホームに戻る
        </Link>
      </div>
    );
  }

  const timeRatioText =
    profile.averageTimeRatio > 1.05
      ? `予定より平均${Math.round((profile.averageTimeRatio - 1) * 100)}%多くかかっています`
      : profile.averageTimeRatio < 0.95
      ? `予定より平均${Math.round((1 - profile.averageTimeRatio) * 100)}%早く終わっています`
      : "予定通りに進んでいます";

  const trendLabel: Record<LearningProfile["difficultyTrend"], string> = {
    improving: "向上傾向",
    stable: "安定",
    struggling: "要注意",
  };
  const trendColor: Record<LearningProfile["difficultyTrend"], string> = {
    improving: "#5c9e2e",
    stable: "#888",
    struggling: "#e53e3e",
  };

  return (
    <div className="min-h-screen" style={{ background: "#f2f2ef" }}>
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm" style={{ color: "#888" }}>
            ← 戻る
          </Link>
          <h1 className="text-base font-bold" style={{ color: "#1a1a1a" }}>
            学習プロフィール
          </h1>
        </div>

        {/* Average completion rate */}
        <section
          className="rounded-xl p-5"
          style={{ background: "#fff", border: "1px solid #e0e0da" }}
        >
          <h2 className="text-xs font-semibold mb-3" style={{ color: "#666" }}>
            平均達成率
          </h2>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 8, background: "#e0e0da" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round(profile.averageCompletionRate))}%`,
                  background: "#5c9e2e",
                }}
              />
            </div>
            <span className="text-lg font-bold" style={{ color: "#5c9e2e" }}>
              {Math.round(profile.averageCompletionRate)}%
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs" style={{ color: "#888" }}>
              難易度トレンド:
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: trendColor[profile.difficultyTrend] }}
            >
              {trendLabel[profile.difficultyTrend]}
            </span>
            <span className="text-xs" style={{ color: "#888" }}>
              ・総学習時間: {Math.round(profile.totalStudyMinutes / 60)}時間
            </span>
          </div>
        </section>

        {/* Time accuracy */}
        <section
          className="rounded-xl p-5"
          style={{ background: "#fff", border: "1px solid #e0e0da" }}
        >
          <h2 className="text-xs font-semibold mb-2" style={{ color: "#666" }}>
            時間の読み精度
          </h2>
          <p className="text-sm" style={{ color: "#444" }}>
            {timeRatioText}
          </p>
          <p className="text-xs mt-1" style={{ color: "#aaa" }}>
            実際/予定 = {profile.averageTimeRatio.toFixed(2)}
          </p>
        </section>

        {/* 7-day chart */}
        <section
          className="rounded-xl p-5"
          style={{ background: "#fff", border: "1px solid #e0e0da" }}
        >
          <h2 className="text-xs font-semibold mb-4" style={{ color: "#666" }}>
            直近7日の達成率推移
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ea" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#aaa" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#aaa" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(v) => [v != null ? `${v}%` : "-", "達成率"]}
                contentStyle={{
                  border: "1px solid #e0e0da",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#5c9e2e"
                strokeWidth={2}
                dot={{ fill: "#5c9e2e", r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Material affinities */}
        {profile.materialAffinities.length > 0 && (
          <section
            className="rounded-xl p-5"
            style={{ background: "#fff", border: "1px solid #e0e0da" }}
          >
            <h2 className="text-xs font-semibold mb-4" style={{ color: "#666" }}>
              教材との相性ランキング
            </h2>
            <div className="flex flex-col gap-3">
              {[...profile.materialAffinities]
                .sort((a, b) => b.completionRate - a.completionRate)
                .map((m, i) => (
                  <div key={m.materialName} className="flex items-center gap-3">
                    <span
                      className="text-xs font-mono w-4 text-right"
                      style={{ color: "#ccc" }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: "#1a1a1a" }}>
                          {m.materialName}
                        </span>
                        <span className="text-xs" style={{ color: "#5c9e2e" }}>
                          {Math.round(m.completionRate)}%
                        </span>
                      </div>
                      <div
                        className="rounded-full overflow-hidden"
                        style={{ height: 4, background: "#e0e0da" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.round(m.completionRate))}%`,
                            background: "#5c9e2e",
                          }}
                        />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>
                        {m.sessionCount}セッション・計{Math.round(m.totalMinutes)}分
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* AI comment */}
        <section
          className="rounded-xl p-5"
          style={{ background: "#fff", border: "1px solid #e0e0da" }}
        >
          <h2 className="text-xs font-semibold mb-3" style={{ color: "#666" }}>
            AIによる総合コメント
          </h2>
          {loadingComment ? (
            <div className="flex items-center gap-2" style={{ color: "#aaa" }}>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              <span className="text-sm">分析中...</span>
            </div>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: "#444" }}>
              {aiComment}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-screen"
          style={{ background: "#f2f2ef", color: "#aaa" }}
        >
          読み込み中...
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
