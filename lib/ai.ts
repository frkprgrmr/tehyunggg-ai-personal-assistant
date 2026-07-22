import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

let _genai: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!_genai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    _genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _genai;
}

export const MODEL = "gemini-3.5-flash-lite";

// ─── System Instruction ────────────────────────────────

export const SYSTEM_INSTRUCTION = `Kamu adalah Tehyungggg, AI Personal Assistant yang berperan sebagai Chief of Staff pribadi untuk Khoerul Umam.

ATURAN UTAMA:
1. Selalu jawab dalam Bahasa Indonesia sehari-hari yang santai tapi tetap informatif.
2. Kamu WAJIB menggunakan tool/function yang tersedia untuk mengubah, membuat, mencari, atau menghapus data task. JANGAN pernah mengarang data atau menjawab tanpa memanggil tool yang relevan.
3. Pahami perintah kasual seperti:
   - "Besok follow up Jorge." → buat task baru dengan dueDate besok
   - "Task migrasi Odoo udah kelar." → cari task terkait, lalu update status ke Done
   - "close aja" / "selesai" → update status task ke Done
   - "gas" / "kerjain" → update status task ke InProgress
   - "nanti aja" / "skip dulu" → bisa dipetakan ke update priority atau reschedule
   - "hapus task X" → cari task, lalu hapus
4. Timezone: User berada di Asia/Jakarta (WIB, UTC+7). Jika user bilang "besok", hitung berdasarkan tanggal hari ini di WIB. Tanggal hari ini di WIB: ${new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", year: "numeric", month: "long", day: "numeric" })}.
5. Saat membuat task, selalu tetapkan default priority Medium dan category Work kecuali user menyebutkan lain.
6. Jika perintah user ambigu (misalnya "close aja" tanpa konteks task sebelumnya), tanyakan kembali ke user task mana yang dimaksud.
7. Setelah berhasil melakukan aksi (create/update/delete), berikan konfirmasi singkat dan informatif ke user tentang apa yang sudah dilakukan.
8. Jika user hanya menyapa atau ngobrol biasa (bukan perintah task), jawab dengan ramah tanpa memanggil tool.`;

// ─── Tool Declarations ─────────────────────────────────

export const toolDeclarations = [
  {
    name: "createTask",
    description:
      "Buat task baru. Gunakan ini ketika user meminta untuk membuat, menambahkan, atau mencatat task/tugas/kerjaan baru.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Judul task yang akan dibuat",
        },
        description: {
          type: Type.STRING,
          description: "Deskripsi detail task (opsional)",
        },
        projectId: {
          type: Type.STRING,
          description: "ID project yang terkait (opsional)",
        },
        dueDate: {
          type: Type.STRING,
          description:
            "Tanggal deadline dalam format ISO 8601 (contoh: 2025-01-15T00:00:00.000Z). Hitung berdasarkan timezone WIB (UTC+7).",
        },
        priority: {
          type: Type.STRING,
          description: "Prioritas task: Low, Medium, High, atau Critical",
          enum: ["Low", "Medium", "High", "Critical"],
        },
        category: {
          type: Type.STRING,
          description: "Kategori task: Work atau Personal",
          enum: ["Work", "Personal"],
        },
      },
      required: ["title"],
    },
  },
  {
    name: "updateTask",
    description:
      "Update/ubah task yang sudah ada. Gunakan ini ketika user meminta untuk mengubah status, judul, priority, due date, atau field lain dari task tertentu. Wajib punya taskId.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: {
          type: Type.STRING,
          description: "ID task yang akan diupdate",
        },
        fields: {
          type: Type.OBJECT,
          description: "Field-field yang akan diubah",
          properties: {
            title: { type: Type.STRING, description: "Judul baru" },
            description: { type: Type.STRING, description: "Deskripsi baru" },
            status: {
              type: Type.STRING,
              description: "Status baru",
              enum: ["Todo", "InProgress", "Done", "Cancelled"],
            },
            priority: {
              type: Type.STRING,
              description: "Prioritas baru",
              enum: ["Low", "Medium", "High", "Critical"],
            },
            category: {
              type: Type.STRING,
              description: "Kategori baru",
              enum: ["Work", "Personal"],
            },
            dueDate: {
              type: Type.STRING,
              description: "Due date baru dalam format ISO 8601",
            },
            projectId: {
              type: Type.STRING,
              description: "Project ID baru",
            },
          },
        },
      },
      required: ["taskId", "fields"],
    },
  },
  {
    name: "deleteTask",
    description:
      "Hapus task. Gunakan ini ketika user meminta untuk menghapus atau membuang task tertentu.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: {
          type: Type.STRING,
          description: "ID task yang akan dihapus",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "searchTask",
    description:
      "Cari atau tampilkan daftar task. Gunakan ini ketika user meminta untuk mencari, melihat, menampilkan, atau meng-list task. Juga gunakan ini untuk mencari task berdasarkan kata kunci sebelum melakukan update atau delete.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            "Kata kunci pencarian untuk mencocokkan judul atau deskripsi task",
        },
        status: {
          type: Type.STRING,
          description: "Filter berdasarkan status",
          enum: ["Todo", "InProgress", "Done", "Cancelled"],
        },
        priority: {
          type: Type.STRING,
          description: "Filter berdasarkan prioritas",
          enum: ["Low", "Medium", "High", "Critical"],
        },
        category: {
          type: Type.STRING,
          description: "Filter berdasarkan kategori",
          enum: ["Work", "Personal"],
        },
        projectId: {
          type: Type.STRING,
          description: "Filter berdasarkan project ID",
        },
      },
    },
  },
] as FunctionDeclaration[];
