import { OPENAI_MODELS } from "@/constants/models";
import type { AppLanguage, LLMProvider } from "@/types";

export interface LLMRequestSettings {
  provider?: LLMProvider;
  apiKey?: string;
  language?: AppLanguage;
}

export function languageInstruction(language?: AppLanguage): string {
  return language === "en"
    ? "Write user-facing TODOs, comments, and explanations in English."
    : "ユーザーに表示するTODO、コメント、解説は日本語で書いてください。";
}

function modelFor(provider: LLMProvider): string {
  return {
    openai: OPENAI_MODELS.MAIN,
    claude: "claude-3-5-haiku-latest",
    gemini: "gemini-2.0-flash",
  }[provider];
}

export async function callTextLLM(prompt: string, settings: LLMRequestSettings = {}): Promise<string> {
  const provider = settings.provider ?? "openai";
  const apiKey = settings.apiKey || (provider === "openai" ? process.env.OPENAI_API_KEY : undefined);

  if (!apiKey) {
    throw new Error(`${provider} API key not set`);
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelFor(provider),
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `OpenAI error ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelFor(provider),
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Claude error ${res.status}`);
    const data = await res.json();
    return data.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelFor(provider)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}

export function parseJsonText(text: string) {
  return JSON.parse(text.replace(/```json\n?|```\n?/g, "").trim());
}
