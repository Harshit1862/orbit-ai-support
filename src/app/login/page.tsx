import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in · Orbit",
};

export default function LoginPage() {
  // LoginForm reads ?forgot=1 from the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
