import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings, knowledgeBase } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { message, conversationHistory = [], context } = body;

    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    // Get user settings
    const [userSettings] = await db.select().from(settings).where(eq(settings.userId, session.userId)).limit(1);

    const apiKey = userSettings?.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured. Please add it in Settings." }, { status: 400 });
    }

    // Get knowledge base for context
    const kbItems = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.userId, session.userId))
      .limit(20);

    const kbContext = kbItems.map(item => `[${item.type.toUpperCase()}] ${item.title}: ${item.content}`).join("\n\n");

    const systemPrompt = userSettings?.openaiSystemPrompt || `You are a professional AI sales agent. Be helpful, concise, and professional.`;

    const messages = [
      {
        role: "system",
        content: `${systemPrompt}\n\n${kbContext ? `KNOWLEDGE BASE:\n${kbContext}` : ""}\n\n${context ? `CONTEXT: ${context}` : ""}`,
      },
      ...conversationHistory.slice(-10),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: userSettings?.openaiModel || "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json({ error: err.error?.message || "OpenAI API error" }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({ reply, usage: data.usage });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
