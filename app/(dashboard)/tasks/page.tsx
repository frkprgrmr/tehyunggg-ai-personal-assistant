import { Suspense } from "react";
import TaskListContent from "@/components/tasks/task-list";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-8 w-32 bg-surface-100 rounded-xl" />
            <div className="h-10 w-28 bg-surface-100 rounded-xl" />
          </div>
          <div className="h-16 bg-surface-50 rounded-2xl border border-white/[0.06]" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-surface-50 rounded-2xl border border-white/[0.06]" />
            ))}
          </div>
        </div>
      }
    >
      <TaskListContent />
    </Suspense>
  );
}
