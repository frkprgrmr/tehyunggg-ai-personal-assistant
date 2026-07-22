import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-brand-400/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/25 mb-4">
            <span className="text-2xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Tehyungggg</h1>
          <p className="text-white/50 mt-1 text-sm">Personal Assistant — Chief of Staff</p>
        </div>

        {/* Login form wrapped in Suspense */}
        <Suspense
          fallback={
            <div className="glass rounded-2xl p-8 animate-pulse">
              <div className="space-y-5">
                <div className="h-10 bg-surface-100 rounded-xl" />
                <div className="h-10 bg-surface-100 rounded-xl" />
                <div className="h-12 bg-surface-100 rounded-xl" />
              </div>
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="text-center text-white/30 text-xs mt-6">
          Single-user system — Khoerul Umam
        </p>
      </div>
    </div>
  );
}
