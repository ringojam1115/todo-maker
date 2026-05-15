import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";
import type { LLMRequestSettings } from "@/lib/llm";
import { languageInstruction, parseJsonText } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { imageBase64, mediaType, materialName, llm }: { imageBase64: string; mediaType: string; materialName?: string; llm?: LLMRequestSettings } = await request.json();
    const provider = llm?.provider ?? "openai";
    const apiKey = llm?.apiKey || (provider === "openai" ? process.env.OPENAI_API_KEY : undefined);
    if (!apiKey) {
      return NextResponse.json({ error: `${provider} API key not set` }, { status: 500 });
    }

    const textPrompt = `
この画像は教材・参考書の目次または概要ページです。
${materialName ? `教材名のヒント: ${materialName}` : ""}
${languageInstruction(llm?.language)}
以下の情報をJSON形式で抽出してください。

{
  "name": "教材名（画像から読み取れる場合）",
  "totalPages": 300,
  "structure": "章・ユニットの構成を詳しく説明。ページ数や問題番号も含める",
  "features": "この教材の特徴・対象レベル"
}

JSONのみ返すこと。マークダウンや説明文は不要。
`.trim();

    let text = "";

    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { inline_data: { mime_type: mediaType, data: imageBase64 } },
                  { text: textPrompt },
                ],
              },
            ],
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Gemini error ${res.status}`);
      const data = await res.json();
      text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    } else if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
                { type: "text", text: textPrompt },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Claude error ${res.status}`);
      const data = await res.json();
      text = data.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
    } else {

      const messages = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mediaType};base64,${imageBase64}`,
            },
          },
          {
            type: "text",
            text: textPrompt,
          },
        ],
      },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODELS.MAIN,
        messages,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const message = errJson?.error?.message ?? `OpenAI error ${res.status}`;
      return NextResponse.json({ error: message }, { status: 500 });
    }

      const data = await res.json();
      text = data.choices[0].message.content;
    }

    const parsed = parseJsonText(text);

    return NextResponse.json({
      id: "",
      name: parsed.name || materialName || "教材",
      structure: parsed.structure,
      totalPages: parsed.totalPages,
      features: parsed.features,
      source: "image" as const,
    });
  } catch (e) {
    console.error("[analyze-material] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
