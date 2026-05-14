"use client";

import { useState } from "react";
import type { Goal } from "@/types";

interface GoalModalProps {
  onClose: () => void;
  onCreate: (goal: Omit<Goal, "id" | "createdAt" | "color">) => void;
  loading: boolean;
}

export default function GoalModal({ onClose, onCreate, loading }: GoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

  const today = new Date().toISOString().split("T")[0];

  function handleCreate() {
    if (!title.trim() || !deadline) return;
    onCreate({ title: title.trim(), description: description.trim(), deadline });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <div
        className="rounded-xl shadow-xl w-[440px] max-w-full mx-4 p-6 flex flex-col gap-5"
        style={{ background: "#fff", border: "1px solid #e0e0da" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
            新しいゴールを追加
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none rounded hover:bg-gray-100 w-7 h-7 flex items-center justify-center"
            style={{ color: "#888" }}
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "#666" }}>
            ゴール名 *
          </label>
          <input
            type="text"
            placeholder="例: Webアプリを完成させる"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              border: "1px solid #e0e0da",
              background: "#f9f9f7",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "#666" }}>
            説明
          </label>
          <textarea
            placeholder="ゴールの詳細を入力..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={{
              border: "1px solid #e0e0da",
              background: "#f9f9f7",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "#666" }}>
            期限 *
          </label>
          <input
            type="date"
            min={today}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              border: "1px solid #e0e0da",
              background: "#f9f9f7",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
          >
            キャンセル
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !deadline || loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50 transition-opacity"
            style={{ background: "#5c9e2e" }}
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            {loading ? "AIが計画中..." : "作成"}
          </button>
        </div>
      </div>
    </div>
  );
}
