import type { ReactNode } from "react";

export function AuthLayout({ brand, children }: { brand: ReactNode; children: ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-shell__content">
        <aside className="auth-shell__brand">{brand}</aside>
        <section className="auth-shell__form">{children}</section>
      </div>
    </main>
  );
}
