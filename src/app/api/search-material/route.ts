import { NextResponse } from "next/server";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { materialName, llm }: { materialName: string; llm?: LLMRequestSettings } = await request.json();

    const prompt = `
「${materialName}」という教材・参考書について、以下のJSON形式で情報を返してください。
${languageInstruction(llm?.language)}

ルール:
- 必ず found: true で回答すること
- 正確な情報が不明な場合は、教材名・タイトルから内容・分野・難易度を合理的に推測して生成してよい
- totalPagesが不明な場合は一般的な同種教材のページ数を推測して入れること
- structureは章・Unit・Partなど実際にありそうな構成を推測して書くこと

{
  "found": true,
  "name": "教材名（入力名をそのまま使うか、正式名があれば正式名）",
  "totalPages": 300,
  "structure": "第1章: ○○（p.1-50）、第2章: ○○（p.51-120）などの構成概要",
  "features": "対象レベル・特徴・おすすめの使い方など"
}

JSONのみ返すこと。マークダウンや説明文は不要。
`.trim();

    const text = await callTextLLM(prompt, llm);
    console.log("[search-material] AI response:", text);
    const parsed = parseJsonText(text);

    if (!parsed.found) {
      return NextResponse.json({ found: false });
    }

    // Fetch book cover from Google Books API (failure is non-fatal)
    let imageUrl: string | undefined;
    try {
      const booksRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(parsed.name)}&maxResults=1&langRestrict=ja`
      );
      if (booksRes.ok) {
        const booksData = await booksRes.json();
        const thumbnail = booksData.items?.[0]?.volumeInfo?.imageLinks?.thumbnail as string | undefined;
        if (thumbnail) {
          imageUrl = thumbnail.replace("http://", "https://");
        }
      }
    } catch {
      // cover fetch failure is non-fatal
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
        imageUrl,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[search-material] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
