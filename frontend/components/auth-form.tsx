"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Errors = Partial<Record<"email" | "username" | "password" | "form", string>>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const { login, register } = useAuth();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const title = registering ? "Create an account" : "Log in";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const next: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (registering && !username) next.username = "Enter a username.";
    if (!password || (registering && password.length < 8)) {
      next.password = registering ? "Use at least eight characters." : "Enter your password.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    submitting.current = true;
    setPending(true);
    try {
      if (registering) await register({ email, username, password });
      else await login({ email, password });
    } catch (error) {
      if (error instanceof ApiError && registering && error.status === 409) {
        setErrors({ email: error.message, username: error.message });
      } else if (error instanceof ApiError && error.status === 400) {
        const fields: Errors = {};
        for (const field of ["email", "username", "password"] as const) {
          const match = error.message.split("; ").find((part) => part.startsWith(`${field}:`));
          if (match) fields[field] = match.slice(field.length + 1).trim();
        }
        setErrors(Object.keys(fields).length ? fields : { form: error.message });
      } else {
        setErrors({ form: error instanceof ApiError ? error.message : "Cannot reach the API. Try again." });
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <p className="text-center text-xl font-semibold">AWS Pokédex</p>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{registering ? "Create your account to use the Pokédex." : "Enter your email and password to continue."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} noValidate aria-label={title} aria-busy={pending}>
              <fieldset disabled={pending} className="space-y-6">
                <FieldGroup>
                  {registering && <Field data-invalid={!!errors.username}>
                    <FieldLabel htmlFor="username">Username</FieldLabel>
                    <Input id="username" name="username" autoComplete="username" required aria-invalid={!!errors.username} aria-describedby={errors.username ? "username-error" : undefined} />
                    <FieldError id="username-error">{errors.username}</FieldError>
                  </Field>}
                  <Field data-invalid={!!errors.email}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
                    <FieldError id="email-error">{errors.email}</FieldError>
                  </Field>
                  <Field data-invalid={!!errors.password}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <div className="relative">
                      <Input className="pr-12" id="password" name="password" type={visible ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 8 : undefined} required aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : registering ? "password-help" : undefined} />
                      <Button className="absolute top-0.5 right-1" variant="ghost" size="icon-sm" type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>
                        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                      </Button>
                    </div>
                    {registering && <FieldDescription id="password-help">Use at least eight characters.</FieldDescription>}
                    <FieldError id="password-error">{errors.password}</FieldError>
                  </Field>
                </FieldGroup>
                {errors.form && <Alert variant="destructive"><AlertDescription>{errors.form}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={pending}>{pending ? "Please wait…" : title}</Button>
              </fieldset>
            </form>
          </CardContent>
          <CardFooter className="justify-center text-sm text-muted-foreground">
            <p>{registering ? "Already have an account?" : "Need an account?"}{" "}<Link className="font-medium text-foreground underline underline-offset-4" href={registering ? "/login" : "/register"}>{registering ? "Log in" : "Register"}</Link></p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
