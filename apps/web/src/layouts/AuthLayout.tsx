import { Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">AdStack</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered newsletter ad marketplace
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
