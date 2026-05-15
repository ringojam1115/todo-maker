import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const { imageBase64, mediaType, materialName } = await request.json();

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
            text: `
この画像は教材・参考書の目次または概要ページです。
${materialName ? `教材名のヒント: ${materialName}` : ""}
以下の情報をJSON形式で抽出してください。

{
  "name": "教材名（画像から読み取れる場合）",
  "totalPages": 300,
  "structure": "章・ユニットの構成を詳しく説明。ページ数や問題番号も含める",
  "features": "この教材の特徴・対象レベル"
}

JSONのみ返すこと。マークダウンや説明文は不要。
`.trim(),
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
    const text: string = data.choices[0].message.content;
    const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

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
