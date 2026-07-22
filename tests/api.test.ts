import "dotenv/config";
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// Mock NextAuth session
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: "test-user-id",
      name: "Khoerul Umam",
      email: "umam@tehyungggg.local",
    },
  }),
}));

// Import route handlers
import { GET as getProjects, POST as createProject } from "@/app/api/projects/route";
import {
  GET as getProjectDetail,
  PATCH as updateProject,
  DELETE as deleteProject,
} from "@/app/api/projects/[id]/route";
import { GET as getTasks, POST as createTask } from "@/app/api/tasks/route";
import {
  GET as getTaskDetail,
  PATCH as updateTask,
  DELETE as deleteTask,
} from "@/app/api/tasks/[id]/route";

describe("Tehyungggg Phase 1 API Integration Tests", () => {
  let projectId: string;
  let taskId: string;

  // Cleanup database before and after tests
  beforeAll(async () => {
    await db.taskLog.deleteMany();
    await db.task.deleteMany();
    await db.project.deleteMany();
  });

  afterAll(async () => {
    await db.taskLog.deleteMany();
    await db.task.deleteMany();
    await db.project.deleteMany();
  });

  // ─── Project CRUD Tests ──────────────────────────────────────────

  describe("Projects API", () => {
    it("should create a project", async () => {
      const req = new NextRequest("http://localhost/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Odoo Project",
          description: "Testing project CRUD",
        }),
      });

      const res = await createProject(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data).toHaveProperty("id");
      expect(data.name).toBe("Test Odoo Project");
      projectId = data.id;
    });

    it("should list projects", async () => {
      const res = await getProjects();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].name).toBe("Test Odoo Project");
    });

    it("should get project detail", async () => {
      const res = await getProjectDetail(
        new NextRequest(`http://localhost/api/projects/${projectId}`),
        { params: Promise.resolve({ id: projectId }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toBe(projectId);
      expect(data.name).toBe("Test Odoo Project");
    });

    it("should update a project", async () => {
      const req = new NextRequest(`http://localhost/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated Odoo Project",
        }),
      });

      const res = await updateProject(req, { params: Promise.resolve({ id: projectId }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.name).toBe("Updated Odoo Project");
    });
  });

  // ─── Task CRUD & Audit Log Tests ─────────────────────────────────

  describe("Tasks API", () => {
    it("should create a task under a project", async () => {
      const req = new NextRequest("http://localhost/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Setup Odoo Docker",
          description: "Initialize development environment",
          projectId: projectId,
          status: "Todo",
          priority: "High",
          category: "Work",
          dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        }),
      });

      const res = await createTask(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data).toHaveProperty("id");
      expect(data.title).toBe("Setup Odoo Docker");
      expect(data.projectId).toBe(projectId);
      taskId = data.id;

      // Verify TaskLog was created for 'created' event
      const logs = await db.taskLog.findMany({ where: { taskId } });
      expect(logs.length).toBe(1);
      expect(logs[0].field).toBe("created");
    });

    it("should list and filter tasks", async () => {
      // Get all tasks
      const resAll = await getTasks(new NextRequest("http://localhost/api/tasks"));
      expect(resAll.status).toBe(200);
      const allTasks = await resAll.json();
      expect(allTasks.length).toBe(1);

      // Filter by status (matching)
      const resMatch = await getTasks(
        new NextRequest("http://localhost/api/tasks?status=Todo")
      );
      const matchTasks = await resMatch.json();
      expect(matchTasks.length).toBe(1);

      // Filter by status (non-matching)
      const resNoMatch = await getTasks(
        new NextRequest("http://localhost/api/tasks?status=Done")
      );
      const noMatchTasks = await resNoMatch.json();
      expect(noMatchTasks.length).toBe(0);
    });

    it("should get task detail with logs", async () => {
      const res = await getTaskDetail(
        new NextRequest(`http://localhost/api/tasks/${taskId}`),
        { params: Promise.resolve({ id: taskId }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toBe(taskId);
      expect(data.logs.length).toBeGreaterThan(0);
      expect(data.logs[0].field).toBe("created");
    });

    it("should update a task and record to TaskLog", async () => {
      const req = new NextRequest(`http://localhost/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "InProgress",
          priority: "Critical",
        }),
      });

      const res = await updateTask(req, { params: Promise.resolve({ id: taskId }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe("InProgress");
      expect(data.priority).toBe("Critical");

      // Verify audit logs were created for both status and priority changes
      const logs = await db.taskLog.findMany({
        where: { taskId, field: { in: ["status", "priority"] } },
        orderBy: { changedAt: "asc" },
      });

      expect(logs.length).toBe(2);
      expect(logs.find((l) => l.field === "status")?.oldValue).toBe("Todo");
      expect(logs.find((l) => l.field === "status")?.newValue).toBe("InProgress");
      expect(logs.find((l) => l.field === "priority")?.oldValue).toBe("High");
      expect(logs.find((l) => l.field === "priority")?.newValue).toBe("Critical");
    });

    it("should delete a task", async () => {
      const res = await deleteTask(
        new NextRequest(`http://localhost/api/tasks/${taskId}`),
        { params: Promise.resolve({ id: taskId }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify task no longer exists
      const task = await db.task.findUnique({ where: { id: taskId } });
      expect(task).toBeNull();
    });
  });

  describe("Cleanup and Delete Project", () => {
    it("should delete a project", async () => {
      const res = await deleteProject(
        new NextRequest(`http://localhost/api/projects/${projectId}`),
        { params: Promise.resolve({ id: projectId }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
