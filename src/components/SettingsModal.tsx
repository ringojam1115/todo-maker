"use client";

import { useEffect, useState } from "react";
import type { AppSettings, LLMProvider } from "@/types";
import { providerLabel, UI_TEXT } from "@/lib/settings";

interface SettingsModalProps {
  settings: AppSettings;
  calendarConnected: boolean;
  onConnectCalendar: (settings: AppSettings) => void;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

const providers: LLMProvider[] = ["openai", "claude", "gemini"];

export default function SettingsModal({
  settings,
  calendarConnected,
  onConnectCalendar,
  onSave,
  onClose,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const t = UI_TEXT[draft.language];

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function update(next: Partial<AppSettings>) {
    setDraft((prev) => ({ ...prev, ...next }));
    setSaved(false);
  }

  function updateKey(provider: LLMProvider, apiKey: string) {
    setDraft((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: apiKey },
    }));
    setSaved(false);
  }

  function save() {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
      <div className="w-[430px] max-w-full overflow-hidden rounded-[18px] border border-[var(--border)] bg-[#f7f7f4] shadow-2xl">
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div>
            <p className="text-[11px] font-medium text-[var(--muted)]">PLN</p>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">{t.settings}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--muted)] shadow-sm hover:text-[var(--text)]"
            aria-label={draft.language === "ja" ? "閉じる" : "Close"}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 pb-4">
          <section className="mb-4">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">Language</p>
            <div className="rounded-xl border border-[var(--border)] bg-white p-1">
              <div className="grid grid-cols-2 gap-1">
                {(["ja", "en"] as const).map((language) => (
                  <button
                    key={language}
                    onClick={() => update({ language })}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
                    style={{
                      background: draft.language === language ? "var(--text)" : "transparent",
                      color: draft.language === language ? "#fff" : "var(--muted)",
                    }}
                  >
                    {language === "ja" ? "日本語" : "English"}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-4">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">LLM</p>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
              {providers.map((provider) => (
                <button
                  key={provider}
                  onClick={() => update({ provider })}
                  className="flex w-full items-center justify-between border-b border-[var(--border)] px-3 py-2.5 text-left last:border-b-0"
                >
                  <span className="text-[12px] font-medium text-[var(--text)]">{providerLabel(provider)}</span>
                  <span
                    className="h-4 w-4 rounded-full border"
                    style={{
                      borderColor: draft.provider === provider ? "var(--accent)" : "var(--border-strong)",
                      background: draft.provider === provider ? "var(--accent)" : "transparent",
                    }}
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="mb-4">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">API Keys</p>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
              {providers.map((provider) => (
                <label key={provider} className="block border-b border-[var(--border)] px-3 py-2.5 last:border-b-0">
                  <span className="mb-1 block text-[11px] text-[var(--muted)]">{providerLabel(provider)}</span>
                  <input
                    type="password"
                    value={draft.apiKeys[provider] ?? ""}
                    onChange={(e) => updateKey(provider, e.target.value)}
                    placeholder="API key"
                    className="w-full bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--muted-2)]"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="mb-4">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-2)]">Google Calendar</p>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
              <label className="block border-b border-[var(--border)] px-3 py-2.5">
                <span className="mb-1 block text-[11px] text-[var(--muted)]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span>
                <input
                  type="text"
                  value={draft.googleClientId ?? ""}
                  onChange={(e) => update({ googleClientId: e.target.value })}
                  placeholder="Google OAuth client ID"
                  className="w-full bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--muted-2)]"
                />
              </label>
              <button
                onClick={() => {
                  onSave(draft);
                  onConnectCalendar(draft);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1800);
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="text-[12px] font-medium text-[var(--text)]">
                  {calendarConnected ? t.calendarConnected : t.connectCalendar}
                </span>
                <span className="text-[11px] text-[var(--accent)]">{calendarConnected ? "Connected" : "Connect"}</span>
              </button>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/70 px-4 py-3">
          <span className="text-[11px] text-[var(--accent)]">{saved ? (draft.language === "ja" ? "保存しました" : "Saved") : ""}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-full px-3 py-1.5 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--panel)]">
              {draft.language === "ja" ? "閉じる" : "Close"}
            </button>
            <button onClick={save} className="rounded-full bg-[var(--text)] px-3.5 py-1.5 text-[11px] font-semibold text-white">
              {draft.language === "ja" ? "保存" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
