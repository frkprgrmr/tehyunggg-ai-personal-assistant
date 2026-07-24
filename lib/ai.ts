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

export const MODEL = (process.env.GEMINI_MODEL || "gemini-3.6-flash-lite") as string;

// ─── System Instruction ────────────────────────────────

export const SYSTEM_INSTRUCTION = `Kamu adalah Tehyungggg, AI Personal Assistant yang berperan sebagai Chief of Staff pribadi untuk Khoerul Umam.

KONTEKS USER:
- Khoerul Umam bekerja di perusahaan Datalake Indonesia (DLI).
- Project utama/default untuk semua task kerjaan (kategori Work) adalah "Datalake Indonesia - DLI".
- Jika user membuat task tanpa menyebutkan project, dan kategorinya Work, maka WAJIB cari project DLI menggunakan searchProject lalu gunakan projectId-nya.

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
8. Jika user hanya menyapa atau ngobrol biasa (bukan perintah task), jawab dengan ramah tanpa memanggil tool.
9. PENTING: Jika user menyebutkan nama project (misal "project DLI", "untuk project X"), kamu WAJIB memanggil searchProject terlebih dahulu untuk mendapatkan projectId-nya, lalu gunakan projectId tersebut saat createTask. Jangan pernah membuat task tanpa projectId jika user sudah menyebutkan nama project.
10. Untuk task kategori Work yang TIDAK disebutkan projectnya, default ke project DLI. Panggil searchProject dulu untuk dapat projectId, baru createTask.
11. REMINDER: Kamu bisa membuat, melihat, dan menghapus/dismiss reminder. Pahami perintah kasual:
   - "Ingetin gue besok jam 9 follow up Jorge" → createReminder dengan remindAt besok jam 09:00 WIB
   - "Reminder apa aja yang aktif?" → listReminders dengan status Pending
   - "Dismiss reminder follow up" → cari dulu dengan listReminders lalu dismissReminder
   - "Set alarm jam 3 sore" → createReminder dengan remindAt hari ini jam 15:00 WIB
12. Saat membuat reminder, selalu konversi waktu WIB ke UTC (kurangi 7 jam) untuk field remindAt.
13. Jika ada task terkait dengan reminder, cari taskId dulu pakai searchTask, lalu isi relatedTaskId.`;

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
  {
    name: "searchProject",
    description:
      "Cari project berdasarkan nama atau kata kunci. Gunakan ini ketika user menyebutkan nama project (misal 'project DLI', 'untuk project X') untuk mendapatkan projectId yang benar sebelum membuat atau memfilter task.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            "Kata kunci pencarian untuk mencocokkan nama atau deskripsi project. Bisa berupa singkatan atau nama lengkap project.",
        },
      },
    },
  },
  {
    name: "createReminder",
    description:
      "Buat reminder/pengingat baru. Gunakan ini ketika user meminta untuk diingatkan sesuatu di waktu tertentu.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Judul singkat reminder",
        },
        message: {
          type: Type.STRING,
          description: "Pesan detail reminder yang akan ditampilkan saat waktunya tiba",
        },
        remindAt: {
          type: Type.STRING,
          description:
            "Waktu reminder dalam format ISO 8601 UTC. Konversi dari WIB (kurangi 7 jam). Contoh: user bilang 'besok jam 9 pagi' (WIB) → '2025-01-16T02:00:00.000Z' (UTC).",
        },
        relatedTaskId: {
          type: Type.STRING,
          description: "ID task yang terkait dengan reminder ini (opsional)",
        },
      },
      required: ["title", "message", "remindAt"],
    },
  },
  {
    name: "listReminders",
    description:
      "Tampilkan daftar reminder. Gunakan ini ketika user bertanya tentang reminder aktif, upcoming, atau yang sudah selesai.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: "Filter berdasarkan status",
          enum: ["Pending", "Sent", "Dismissed"],
        },
        upcoming: {
          type: Type.BOOLEAN,
          description: "Jika true, hanya tampilkan reminder Pending yang belum jatuh tempo",
        },
      },
    },
  },
  {
    name: "dismissReminder",
    description:
      "Dismiss/selesaikan reminder. Gunakan ini ketika user ingin menandai reminder sebagai selesai atau tidak perlu lagi.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reminderId: {
          type: Type.STRING,
          description: "ID reminder yang akan di-dismiss",
        },
      },
      required: ["reminderId"],
    },
  },
] as FunctionDeclaration[];
