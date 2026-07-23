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
  //    Fetch latest 50 messages (desc order), then reverse to chronological
  const history = await db.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  history.reverse();

  // Convert DB history to Gemini format, filtering out tool messages
  const rawContents: Content[] = history
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: (msg.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: msg.content }],
    }));

  // Safeguard: merge consecutive same-role messages & ensure valid turn order
  const contents: Content[] = [];
  for (const entry of rawContents) {
    const last = contents[contents.length - 1];
    if (last && last.role === entry.role) {
      // Merge consecutive same-role messages
      const prevText = last.parts?.map((p) => ("text" in p ? p.text : "")).join("\n") || "";
      const newText = entry.parts?.map((p) => ("text" in p ? p.text : "")).join("\n") || "";
      last.parts = [{ text: prevText + "\n" + newText }];
    } else {
      contents.push({ ...entry });
    }
  }

  // Gemini requires: first message = "user", last message = "user"
  while (contents.length > 0 && contents[0].role !== "user") {
    contents.shift();
  }
  while (contents.length > 0 && contents[contents.length - 1].role !== "user") {
    contents.pop();
  }

  // Safety: if no valid contents, add at least the current user message
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: message }] });
  }

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
    let maxRounds = 10; // Safety limit to prevent infinite loops
    // Accumulate full context across tool call rounds
    let accumulatedContents: Content[] = [...contents];

    while (response.functionCalls && response.functionCalls.length > 0 && maxRounds > 0) {
      maxRounds--;

      const functionCalls = response.functionCalls;

      // Add model's response to accumulated context (preserves thought_signature for Gemini 3.x)
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        accumulatedContents.push(modelContent);
      }

      // Execute each function call
      const responseParts = [];
      for (const fc of functionCalls) {
        const result = await executeToolCall(
          fc.name!,
          (fc.args as Record<string, unknown>) || {},
          { userId }
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

      // Add function responses to accumulated context
      accumulatedContents.push({
        role: "user" as const,
        parts: responseParts,
      });

      // Call Gemini again with full accumulated context
      response = await getGenAI().models.generateContent({
        model: MODEL,
        contents: accumulatedContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });
    }

    // 5. Extract final text response (robust: response.text can throw on thinking models)
    let aiText = "";
    try {
      aiText = response.text || "";
    } catch {
      // response.text throws if no text candidates (e.g. thinking-only response)
    }

    // Fallback: try extracting text from candidate parts directly
    if (!aiText) {
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        aiText = parts
          .filter((p) => "text" in p && typeof p.text === "string")
          .map((p) => (p as { text: string }).text)
          .join("");
      }
    }

    // If still no text but we had tool calls, make one final call WITHOUT tools
    // to force the model to generate a text summary
    if (!aiText && toolResults.length > 0) {
      console.log("[Chat API] No text after tool calls, making final text-only call...");
      // Add model's last response if it had content
      const lastModelContent = response.candidates?.[0]?.content;
      if (lastModelContent) {
        accumulatedContents.push(lastModelContent);
      }
      // Add a nudge to generate text
      accumulatedContents.push({
        role: "user" as const,
        parts: [{ text: "Tolong berikan ringkasan dari aksi yang sudah kamu lakukan tadi." }],
      });

      try {
        const textResponse = await getGenAI().models.generateContent({
          model: MODEL,
          contents: accumulatedContents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            // No tools — force text response
          },
        });
        try {
          aiText = textResponse.text || "";
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn("[Chat API] Final text-only call failed:", err);
      }
    }

    if (!aiText) {
      aiText = "Aku sudah selesai memproses permintaanmu! 👍";
    }

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
