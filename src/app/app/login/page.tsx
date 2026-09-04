import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--graphite)] text-[var(--steel)]">
          Carregando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
