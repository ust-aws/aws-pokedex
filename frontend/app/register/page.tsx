import { AuthBoundary } from "@/components/auth-boundary";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <AuthBoundary guest><AuthForm mode="register" /></AuthBoundary>;
}
