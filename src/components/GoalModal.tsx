"use client";

import { useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Goal, Material } from "@/types";

type MaterialSearchState =
  | "idle"
  | "searching"
  | "found"
  | "not_found"
  | "uploading"
  | "analyzed";

interface GoalModalProps {
  onClose: () => void;
  onCreate: (goal: Omit<Goal, "id" | "createdAt" | "color">) => void;
  loading: boolean;
  activeGoals?: Goal[];
}

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

export default function GoalModal({ onClose, onCreate, loading, activeGoals = [] }: GoalModalProps) {
  const today = new Date().toISOString().split("T")[0];

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(60);

  // Step 2
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [materialSearchState, setMaterialSearchState] = useState<MaterialSearchState>("idle");
  const [searchResult, setSearchResult] = useState<Material | null>(null);
  const [analyzedMaterial, setAnalyzedMaterial] = useState<Material | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function canProceedStep1() {
    return title.trim() !== "" && deadline !== "";
  }

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
    // Reset input so same file can be re-uploaded
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

  function handleCreate() {
    if (!title.trim() || !deadline) return;
    onCreate({
      title: title.trim(),
      description: "",
      deadline,
      currentLevel: currentLevel.trim(),
      dailyMinutes,
      materials,
    });
  }

  function MaterialCard({ m, onAdd }: { m: Material; onAdd: () => void }) {
    return (
      <div
        className="rounded-lg p-4 flex flex-col gap-3"
        style={{ background: "#f0f7e8", border: "1px solid #c3e0a0" }}
      >
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
            <p className="text-xs font-medium mb-1" style={{ color: "#5c9e2e" }}>
              この教材で合っていますか？
            </p>
            <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>
              {m.name}
            </p>
            {m.totalPages && (
              <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                総ページ数: {m.totalPages}p
              </p>
            )}
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#555" }}>
              {m.structure}
            </p>
            {m.features && (
              <p className="text-xs mt-1" style={{ color: "#888" }}>
                {m.features}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: "#5c9e2e" }}
          >
            はい、追加する
          </button>
          <button
            onClick={resetSearch}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
          >
            違う、やり直す
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <div
        className="rounded-xl shadow-xl w-[520px] max-w-full mx-4 flex flex-col"
        style={{ background: "#fff", border: "1px solid #e0e0da", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #e0e0da" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
              新しいゴールを追加
            </h2>
            <div className="flex gap-1.5">
              {([1, 2, 3] as const).map((s) => (
                <div
                  key={s}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ background: s <= step ? "#5c9e2e" : "#e0e0da" }}
                />
              ))}
            </div>
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
          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold" style={{ color: "#5c9e2e" }}>
                Step 1 — 基本情報
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "#666" }}>
                  目標タイトル *
                </label>
                <input
                  type="text"
                  placeholder="例: TOEIC 800点を取る"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
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
                  style={inputStyle}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "#666" }}>
                  現在のレベル
                </label>
                <input
                  type="text"
                  placeholder="例: 現在TOEIC 600点"
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "#666" }}>
                  1日に使える学習時間（分）
                </label>
                <input
                  type="number"
                  min={10}
                  max={480}
                  value={dailyMinutes}
                  onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold" style={{ color: "#5c9e2e" }}>
                Step 2 — 教材設定
              </p>

              {/* Search input */}
              {(materialSearchState === "idle" || materialSearchState === "searching") && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium" style={{ color: "#666" }}>
                    教材名を入力して検索
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="例: 公式TOEIC問題集Vol.7"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                      style={inputStyle}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || materialSearchState === "searching"}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
                      style={{ background: "#5c9e2e" }}
                    >
                      {materialSearchState === "searching" && <Spinner />}
                      {materialSearchState === "searching" ? "検索中..." : "検索"}
                    </button>
                  </div>
                </div>
              )}

              {/* Found result */}
              {materialSearchState === "found" && searchResult && (
                <MaterialCard m={searchResult} onAdd={() => addMaterial(searchResult)} />
              )}

              {/* Not found — prompt image upload */}
              {(materialSearchState === "not_found" || materialSearchState === "uploading") && (
                <div
                  className="rounded-lg p-4 flex flex-col gap-3"
                  style={{ background: "#fff8e8", border: "1px solid #e0c87a" }}
                >
                  <p className="text-sm" style={{ color: "#666" }}>
                    情報が見つかりませんでした。目次の写真をアップロードしてください。
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={materialSearchState === "uploading"}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex items-center gap-2"
                      style={{ background: "#5c9e2e" }}
                    >
                      {materialSearchState === "uploading" && <Spinner />}
                      {materialSearchState === "uploading" ? "解析中..." : "画像をアップロード"}
                    </button>
                    <button
                      onClick={resetSearch}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
                    >
                      やり直す
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              )}

              {/* Analyzed result */}
              {materialSearchState === "analyzed" && analyzedMaterial && (
                <MaterialCard m={analyzedMaterial} onAdd={() => addMaterial(analyzedMaterial)} />
              )}

              {/* Added materials list */}
              {materials.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium" style={{ color: "#666" }}>
                    追加済みの教材
                  </p>
                  {materials.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: "#f9f9f7", border: "1px solid #e0e0da" }}
                    >
                      <span className="text-sm" style={{ color: "#1a1a1a" }}>
                        {m.name}
                      </span>
                      <button
                        onClick={() => removeMaterial(m.id)}
                        className="text-xs hover:opacity-70 transition-opacity"
                        style={{ color: "#aaa" }}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                  {materialSearchState === "idle" && (
                    <button
                      onClick={resetSearch}
                      className="text-xs text-left hover:opacity-70 transition-opacity"
                      style={{ color: "#5c9e2e" }}
                    >
                      + 別の教材を追加
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold" style={{ color: "#5c9e2e" }}>
                Step 3 — 確認・生成
              </p>

              {/* Feasibility warnings */}
              {(() => {
                const daysLeft = deadline
                  ? Math.ceil(
                      (new Date(deadline + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0;
                const totalTime = daysLeft * dailyMinutes;
                const otherDailyMinutes = activeGoals.reduce((s, g) => s + (g.dailyMinutes ?? 0), 0);
                const totalDailyCommitment = dailyMinutes + otherDailyMinutes;
                const warnings: string[] = [];
                if (daysLeft < 7) warnings.push("残り日数が7日未満です。目標達成が難しい可能性があります。");
                if (totalTime < 600) warnings.push(`総学習時間が${totalTime}分（約${Math.round(totalTime / 60)}時間）と少ない可能性があります。`);
                if (totalDailyCommitment > 360) warnings.push(`他の目標と合わせた1日の学習時間が${totalDailyCommitment}分になります。無理のない範囲で設定しましょう。`);
                if (warnings.length === 0) return null;
                return (
                  <div className="flex flex-col gap-2">
                    {warnings.map((w) => (
                      <div key={w} className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fff8e8", border: "1px solid #e0c87a", color: "#7a5200" }}>
                        ⚠️ {w}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div
                className="rounded-lg p-4 flex flex-col gap-2.5"
                style={{ background: "#f9f9f7", border: "1px solid #e0e0da" }}
              >
                {[
                  ["タイトル", title],
                  ["期限", deadline],
                  currentLevel ? ["現在のレベル", currentLevel] : null,
                  ["1日の学習時間", `${dailyMinutes}分`],
                  [
                    "教材",
                    materials.length > 0 ? materials.map((m) => m.name).join("、") : "未設定",
                  ],
                ]
                  .filter((item): item is [string, string] => item !== null)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-xs flex-shrink-0" style={{ color: "#888" }}>
                        {label}
                      </span>
                      <span
                        className="text-xs font-medium text-right"
                        style={{ color: "#1a1a1a" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
              </div>

              {loading && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ background: "#f0f7e8", color: "#5c9e2e" }}
                >
                  <Spinner />
                  AIがプランを生成中です。しばらくお待ちください...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid #e0e0da" }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
          >
            キャンセル
          </button>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ color: "#666", background: "#f0f0ec", border: "1px solid #e0e0da" }}
              >
                戻る
              </button>
            )}

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                style={{ background: "#5c9e2e" }}
              >
                次へ
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "#5c9e2e" }}
              >
                {materials.length > 0 ? "次へ" : "教材なしで進める"}
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: "#5c9e2e" }}
              >
                {loading && <Spinner />}
                {loading ? "AIが計画中..." : "プランを生成"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
