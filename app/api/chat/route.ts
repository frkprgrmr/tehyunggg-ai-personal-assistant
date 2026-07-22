import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGenAI, MODEL, SYSTEM_INSTRUCTION, toolDeclarations } from "@/lib/ai";
import { executeToolCall } from "@/lib/ai-tools";
import { Content } from "@google/genai";

// POST /api/chat — Send a message and get AI response
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await request.json();
  if (!message || typeof message !== "string") {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const userId = session.user.id!;

  // 1. Save user message to conversation
  await db.conversation.create({
    data: { userId, role: "user", content: message },
  });

  // 2. Build conversation history for Gemini context
  const history = await db.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 50, // Limit context window
  });

  // Convert DB history to Gemini format
  const contents: Content[] = history
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

  // 3. Call Gemini with tools
  try {
    let response = await getGenAI().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    // 4. Handle function calls (may be multiple rounds)
    const toolResults: { name: string; args: Record<string, unknown>; result: unknown }[] = [];
    let maxRounds = 5; // Safety limit to prevent infinite loops

    while (response.functionCalls && response.functionCalls.length > 0 && maxRounds > 0) {
      maxRounds--;

      const functionCalls = response.functionCalls;
      const functionResponses: Content[] = [...contents];

      // Add model's original response (preserves thought_signature for Gemini 3.x)
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        functionResponses.push(modelContent);
      }

      // Execute each function call
      const responseParts = [];
      for (const fc of functionCalls) {
        const result = await executeToolCall(
          fc.name!,
          (fc.args as Record<string, unknown>) || {}
        );
        toolResults.push({
          name: fc.name!,
          args: (fc.args as Record<string, unknown>) || {},
          result,
        });
        responseParts.push({
          functionResponse: {
            name: fc.name!,
            response: { result } as Record<string, unknown>,
          },
        });
      }

      // Add function responses to context
      functionResponses.push({
        role: "user" as const,
        parts: responseParts,
      });

      // Call Gemini again with function results
      response = await getGenAI().models.generateContent({
        model: MODEL,
        contents: functionResponses,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });
    }

    // 5. Extract final text response
    const aiText = response.text || "Maaf, aku tidak bisa memproses permintaan itu.";

    // 6. Save tool calls to conversation
    if (toolResults.length > 0) {
      await db.conversation.create({
        data: {
          userId,
          role: "tool",
          content: JSON.stringify(toolResults),
        },
      });
    }

    // 7. Save AI response to conversation
    await db.conversation.create({
      data: { userId, role: "assistant", content: aiText },
    });

    return Response.json({
      message: aiText,
      toolCalls: toolResults.length > 0 ? toolResults : undefined,
    });
  } catch (error) {
    console.error("[Chat API Error]", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "AI processing failed", details: errorMessage },
      { status: 500 }
    );
  }
}
