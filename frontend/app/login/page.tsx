import { AuthBoundary } from "@/components/auth-boundary";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return <AuthBoundary guest><AuthForm mode="login" /></AuthBoundary>;
}
