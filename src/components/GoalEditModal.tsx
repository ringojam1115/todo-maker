"use client";

import { useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Goal, Material } from "@/types";

interface GoalEditModalProps {
  goal: Goal;
  onClose: () => void;
  onSave: (updatedGoal: Goal, regenerate: boolean) => void;
  loading: boolean;
}

type MaterialSearchState = "idle" | "searching" | "found" | "not_found" | "uploading" | "analyzed";

function Spinner({ size = "w-4 h-4" }: { size?: string }) {
  return (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

const inputStyle = {
  border: "1px solid #e0e0da",
  background: "#f9f9f7",
  fontFamily: "var(--font-manrope), sans-serif",
};

export default function GoalEditModal({ goal, onClose, onSave, loading }: GoalEditModalProps) {
  const today = new Date().toISOString().split("T")[0];

  const [title, setTitle] = useState(goal.title);
  const [deadline, setDeadline] = useState(goal.deadline);
  const [currentLevel, setCurrentLevel] = useState(goal.currentLevel ?? "");
  const [dailyMinutes, setDailyMinutes] = useState(goal.dailyMinutes ?? 60);
  const [materials, setMaterials] = useState<Material[]>(goal.materials ?? []);
  const [regenerate, setRegenerate] = useState(false);

  // Material search (same pattern as GoalModal)
  const [searchQuery, setSearchQuery] = useState("");
  const [materialSearchState, setMaterialSearchState] = useState<MaterialSearchState>("idle");
  const [searchResult, setSearchResult] = useState<Material | null>(null);
  const [analyzedMaterial, setAnalyzedMaterial] = useState<Material | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setMaterialSearchState("searching");
    try {
      const res = await fetch("/api/search-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialName: searchQuery }),
      });
      const data = await res.json();
      if (data.found && data.material) {
        setSearchResult(data.material);
        setMaterialSearchState("found");
      } else {
        setMaterialSearchState("not_found");
      }
    } catch {
      setMaterialSearchState("not_found");
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMaterialSearchState("uploading");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      try {
        const res = await fetch("/api/analyze-material", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType: file.type, materialName: searchQuery }),
        });
        const data = await res.json();
        setAnalyzedMaterial(data);
        setMaterialSearchState("analyzed");
      } catch {
        setMaterialSearchState("not_found");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function addMaterial(m: Material) {
    setMaterials((prev) => [...prev, { ...m, id: uuidv4() }]);
    resetSearch();
  }

  function removeMaterial(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  function resetSearch() {
    setMaterialSearchState("idle");
    setSearchQuery("");
    setSearchResult(null);
    setAnalyzedMaterial(null);
  }

  function handleSave() {
    if (!title.trim() || !deadline) return;
    onSave(
      {
        ...goal,
        title: title.trim(),
        deadline,
        currentLevel: currentLevel.trim(),
        dailyMinutes,
        materials,
      },
      regenerate
    );
  }

  function MaterialCard({ m, onAdd }: { m: Material; onAdd: () => void }) {
    return (
      <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "#f0f7e8", border: "1px solid #c3e0a0" }}>
        <div className="flex gap-3">
          {m.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.imageUrl}
              alt={m.name}
              className="rounded flex-shrink-0 object-cover"
              style={{ width: 56, height: 80 }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium mb-1" style={{ color: "#5c9e2e" }}>この教材で合っていますか？</p>
            <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{m.name}</p>
            {m.totalPages && <p className="text-xs mt-0.5" style={{ color: "#666" }}>総ページ数: {m.totalPages}p</p>}
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#555" }}>{m.structure}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onAdd} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#5c9e2e" }}>
            はい、追加する
          </button>
          <button onClick={resetSearch} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}>
            違う、やり直す
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
      <div className="rounded-xl shadow-xl w-[520px] max-w-full mx-4 flex flex-col" style={{ background: "#fff", border: "1px solid #e0e0da", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e0e0da" }}>
          <h2 className="text-base font-semibold" style={{ color: "#1a1a1a" }}>ゴールを編集</h2>
          <button onClick={onClose} className="text-lg leading-none rounded hover:bg-gray-100 w-7 h-7 flex items-center justify-center" style={{ color: "#888" }}>×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Basic info */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "#666" }}>目標タイトル *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "#666" }}>期限 *</label>
            <input type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "#666" }}>現在のレベル</label>
            <input type="text" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} placeholder="例: TOEIC 650点" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "#666" }}>1日の学習時間（分）</label>
            <input type="number" min={10} max={480} value={dailyMinutes} onChange={(e) => setDailyMinutes(Number(e.target.value))} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>

          {/* Materials */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium" style={{ color: "#666" }}>使用教材</p>
            {materials.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#f9f9f7", border: "1px solid #e0e0da" }}>
                <span className="text-sm" style={{ color: "#1a1a1a" }}>{m.name}</span>
                <button onClick={() => removeMaterial(m.id)} className="text-xs hover:opacity-70" style={{ color: "#aaa" }}>削除</button>
              </div>
            ))}

            {materialSearchState === "idle" && (
              <div className="flex gap-2">
                <input type="text" placeholder="教材名を検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none" style={inputStyle} />
                <button onClick={handleSearch} disabled={!searchQuery.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: "#5c9e2e" }}>検索</button>
              </div>
            )}
            {materialSearchState === "searching" && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#888" }}><Spinner size="w-3 h-3" /> 検索中...</div>
            )}
            {materialSearchState === "found" && searchResult && (
              <MaterialCard m={searchResult} onAdd={() => addMaterial(searchResult)} />
            )}
            {(materialSearchState === "not_found" || materialSearchState === "uploading") && (
              <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "#fff8e8", border: "1px solid #e0c87a" }}>
                <p className="text-xs" style={{ color: "#666" }}>見つかりませんでした。目次画像をアップロード</p>
                <div className="flex gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={materialSearchState === "uploading"} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1" style={{ background: "#5c9e2e" }}>
                    {materialSearchState === "uploading" && <Spinner size="w-3 h-3" />}
                    {materialSearchState === "uploading" ? "解析中..." : "画像をアップロード"}
                  </button>
                  <button onClick={resetSearch} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}>やり直す</button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            )}
            {materialSearchState === "analyzed" && analyzedMaterial && (
              <MaterialCard m={analyzedMaterial} onAdd={() => addMaterial(analyzedMaterial)} />
            )}
          </div>

          {/* Regenerate option */}
          <label className="flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg" style={{ background: "#f9f9f7", border: "1px solid #e0e0da" }}>
            <input type="checkbox" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} className="rounded" style={{ accentColor: "#5c9e2e" }} />
            <div>
              <p className="text-xs font-medium" style={{ color: "#1a1a1a" }}>今日以降のプランを再生成する</p>
              <p className="text-xs" style={{ color: "#888" }}>変更した設定で明日以降のTODOを作り直します</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e0e0da" }}>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}>
            キャンセル
          </button>
          <button onClick={handleSave} disabled={!title.trim() || !deadline || loading} className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50 transition-opacity" style={{ background: "#5c9e2e" }}>
            {loading && <Spinner />}
            {loading ? (regenerate ? "再生成中..." : "保存中...") : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
