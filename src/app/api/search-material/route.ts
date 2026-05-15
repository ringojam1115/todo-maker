import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const { materialName } = await request.json();

    const prompt = `
「${materialName}」という教材・参考書について調べてください。

以下の情報をJSON形式で返してください。
教材が実在しない・情報が不明な場合は found: false を返すこと。

{
  "found": true,
  "name": "正式な教材名",
  "totalPages": 300,
  "structure": "Unit1: 基礎文法（p.1-50）、Unit2: リスニング（p.51-120）... のような章・ユニット構成",
  "features": "この教材の特徴・学習対象者・難易度"
}

または

{
  "found": false
}

JSONのみ返すこと。マークダウンや説明文は不要。
`.trim();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODELS.SEARCH,
        messages: [{ role: "user", content: prompt }],
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

    if (!parsed.found) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      material: {
        id: "",
        name: parsed.name,
        structure: parsed.structure,
        totalPages: parsed.totalPages,
        features: parsed.features,
        source: "search" as const,
      },
    });
  } catch (e) {
    console.error("[search-material] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
