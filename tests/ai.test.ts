import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  handleCreateTask,
  handleUpdateTask,
  handleDeleteTask,
  handleSearchTask,
} from "@/lib/ai-tools";

describe("Phase 2 — AI Tool Handlers", () => {
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    const project = await db.project.create({
      data: {
        name: "AI Test Project",
        description: "Project for testing AI tools",
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    // Cleanup in correct order
    await db.taskLog.deleteMany();
    await db.task.deleteMany();
    await db.project.deleteMany();
  });

  it("createTask: should create task and log with changedBy 'system'", async () => {
    const task = await handleCreateTask({
      title: "Follow up Jorge",
      description: "Testing AI createTask tool",
      projectId,
      priority: "High",
      category: "Work",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    });

    expect(task).toHaveProperty("id");
    expect(task.title).toBe("Follow up Jorge");
    expect(task.priority).toBe("High");
    expect(task.category).toBe("Work");
    expect(task.projectId).toBe(projectId);
    taskId = task.id;

    // Verify TaskLog changedBy is "system" not "user"
    const logs = await db.taskLog.findMany({ where: { taskId } });
    expect(logs.length).toBe(1);
    expect(logs[0].field).toBe("created");
    expect(logs[0].changedBy).toBe("system");
  });

  it("searchTask: should find task by query", async () => {
    const results = await handleSearchTask({ query: "Jorge" });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((t) => t.id === taskId)).toBe(true);
  });

  it("searchTask: should filter by status", async () => {
    const results = await handleSearchTask({ status: "Todo" });
    expect(results.some((t) => t.id === taskId)).toBe(true);

    const noResults = await handleSearchTask({ status: "Done" });
    expect(noResults.some((t) => t.id === taskId)).toBe(false);
  });

  it("updateTask: should update status and log with changedBy 'system'", async () => {
    const result = await handleUpdateTask({
      taskId,
      fields: { status: "Done" },
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.status).toBe("Done");
      expect(result.completedAt).not.toBeNull();
    }

    // Verify audit log
    const logs = await db.taskLog.findMany({
      where: { taskId, field: "status" },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].oldValue).toBe("Todo");
    expect(logs[0].newValue).toBe("Done");
    expect(logs[0].changedBy).toBe("system");
  });

  it("updateTask: should return error for non-existent task", async () => {
    const result = await handleUpdateTask({
      taskId: "non-existent-id",
      fields: { status: "Done" },
    });
    expect(result).toHaveProperty("error");
  });

  it("deleteTask: should delete and return success", async () => {
    const result = await handleDeleteTask({ taskId });
    expect(result.success).toBe(true);
    expect(result).toHaveProperty("deletedTitle", "Follow up Jorge");

    const check = await db.task.findUnique({ where: { id: taskId } });
    expect(check).toBeNull();
  });

  it("deleteTask: should return error for non-existent task", async () => {
    const result = await handleDeleteTask({ taskId: "non-existent-id" });
    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error");
  });
});
