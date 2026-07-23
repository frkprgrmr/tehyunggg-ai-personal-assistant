"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ListTodo,
  FolderKanban,
  MessageSquare,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, ReactNode } from "react";
import NotificationBell from "@/components/notifications/notification-bell";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/reminders", label: "Reminders", icon: Bell },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-white/[0.06] bg-surface-50 transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-[240px]"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-600/20">
            <span className="text-sm font-bold text-white">T</span>
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-white animate-fade-in">
              Tehyungggg
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-brand-600/15 text-brand-400 border border-brand-500/20"
                    : "text-white/50 hover:text-white hover:bg-surface-100 border border-transparent"
                }`}
              >
                <Icon
                  size={20}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? "text-brand-400" : "text-white/40 group-hover:text-white/70"
                  }`}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User & Collapse */}
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          {/* User info */}
          {session?.user && (
            <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-brand-400">
                  {session.user.name?.charAt(0) || "U"}
                </span>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-white/40 truncate">{session.user.email}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer ${
                collapsed ? "w-full justify-center" : ""
              }`}
              title="Logout"
            >
              <LogOut size={18} />
              {!collapsed && <span>Logout</span>}
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="ml-auto p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-surface-100 transition-all cursor-pointer"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
