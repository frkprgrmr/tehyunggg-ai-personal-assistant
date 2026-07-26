import { getGenAI, MODEL } from "@/lib/ai";

// ─── Types ─────────────────────────────────────────────

export interface TaskCandidate {
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  dueDate: string | null; // ISO string or null
}

export interface MeetingAnalysisResult {
  summary: string;
  taskCandidates: TaskCandidate[];
}

// ─── Summarize Meeting ──────────────────────────────────

export async function summarizeMeeting(
  title: string,
  transcript: string,
  participants: string[]
): Promise<string> {
  const prompt = `Kamu adalah Tehyungggg, AI Personal Assistant. Buat ringkasan singkat dan padat dari transkrip meeting berikut dalam Bahasa Indonesia.

Judul Meeting: ${title}
Peserta: ${participants.join(", ") || "tidak disebutkan"}

Transkrip:
${transcript}

Buat ringkasan yang mencakup:
1. Topik utama yang dibahas
2. Keputusan penting yang diambil
3. Action items yang disebutkan (jika ada)

Format: paragraf singkat 3-5 kalimat. Jangan bullet point.`;

  const response = await getGenAI().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  return extractText(response) || "Tidak dapat membuat ringkasan.";
}

// ─── Extract Task Candidates ────────────────────────────

export async function extractTaskCandidates(
  transcript: string,
  summary: string
): Promise<TaskCandidate[]> {
  const today = new Date().toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `Kamu adalah Tehyungggg, AI Personal Assistant. Ekstrak semua action items dan task dari transkrip meeting berikut.

Tanggal hari ini: ${today}

Ringkasan Meeting:
${summary}

Transkrip:
${transcript}

Ekstrak semua task/action item yang disebutkan. Kembalikan dalam format JSON array berikut (HANYA JSON, tidak ada teks lain):

[
  {
    "title": "Judul task singkat dan action-oriented (dalam Bahasa Inggris atau Indonesia, tapi profesional)",
    "description": "Konteks/detail dari transkrip, termasuk siapa yang bertanggung jawab jika disebutkan",
    "priority": "Low|Medium|High|Critical",
    "dueDate": "ISO 8601 date string UTC jika ada deadline yang disebutkan, atau null jika tidak ada"
  }
]

Aturan:
- Jika tidak ada action item sama sekali, kembalikan array kosong: []
- Priority: Critical jika urgent/deadline dekat, High jika penting, Medium default, Low jika nice-to-have
- Title harus singkat, action-oriented, maksimal 10 kata
- Jangan duplikasi task yang sama meski disebutkan berkali-kali`;

  const response = await getGenAI().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = extractText(response);

  try {
    // Extract JSON from response (remove markdown code blocks if any)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    // Validate and sanitize each candidate
    return parsed
      .filter((item) => item && typeof item.title === "string")
      .map((item) => ({
        title: String(item.title).trim(),
        description: String(item.description || "").trim(),
        priority: (["Low", "Medium", "High", "Critical"].includes(item.priority)
          ? item.priority
          : "Medium") as TaskCandidate["priority"],
        dueDate: item.dueDate || null,
      }));
  } catch {
    console.error("[MeetingAnalyzer] Failed to parse task candidates:", text);
    return [];
  }
}

// ─── Full Analyze Pipeline ──────────────────────────────

export async function analyzeMeeting(
  title: string,
  transcript: string,
  participants: string[]
): Promise<MeetingAnalysisResult> {
  const [summary, taskCandidates] = await Promise.all([
    summarizeMeeting(title, transcript, participants),
    // We need the summary first for better task extraction context,
    // but run parallel and use the transcript directly for task extraction
    extractTaskCandidates(transcript, ""),
  ]);

  // Re-run task extraction with the actual summary for better context
  const taskCandidatesWithSummary = await extractTaskCandidates(transcript, summary);

  return {
    summary,
    taskCandidates: taskCandidatesWithSummary,
  };
}

// ─── Helpers ───────────────────────────────────────────

function extractText(response: Awaited<ReturnType<ReturnType<typeof getGenAI>["models"]["generateContent"]>>): string {
  try {
    return response.text || "";
  } catch {
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      return parts
        .filter((p) => "text" in p && typeof p.text === "string")
        .map((p) => (p as { text: string }).text)
        .join("");
    }
    return "";
  }
}
