"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/components/auth-provider";
import { api, ApiError } from "@/lib/api";

type User = {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  createdAt: string;
};

//Icons for 'show password' button in edit field
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

//Table for editing user details
export function UserFormModal({ selectedUser }: {
  selectedUser: User;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  //Checks if current user is the same as user being edited (to prevent role changing)
  const roleLocked = user?.id === selectedUser.id;

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState<string>(selectedUser.username);
  const [email, setEmail] = useState<string>(selectedUser.email);
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<"user" | "admin">(selectedUser.role);
  const [confirm, setConfirm] = useState(false);

  //Resets form values if user exits without saving changes
  const handleCancel = () => {
    setUsername(selectedUser.username);
    setEmail(selectedUser.email);
    setPassword("");
    setRole(selectedUser.role);

    setOpen(false);
  }

  //Function saving the new edited values (Disabled)
  //Remove comment tags or create a new function when implementing backend
  /* const handleEditConfirm = async () => {
    setError(null);
    setSaving(true);

    try {
      //EDIT LOGIC GOES HERE

      setConfirm(false);
      setOpen(false);
    } catch(err) {
      //Where an API 403 error would go if the user tries to change their role through backend means
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  } */

  return (
    <>
      {/* Edit button to open the actual form */}
      <Button variant="outline" size="sm" className="hover:bg-slate-300" onClick={() => setOpen(true)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 20 5 15.5 15.5 5 19 8.5 8.5 19Z" />
          <path d="M13 7.5 16.5 11" />
          <path d="M13 21h8" />
        </svg>
      </Button>

      {/* User Form Modal */}
      <Dialog open={open} onOpenChange={handleCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Information</DialogTitle>
            <DialogDescription>Edit the information of user {selectedUser.username}.</DialogDescription>
          </DialogHeader>

          <div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                  id="edit-username"
                  placeholder="Enter Username ..."
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="mt-5" />
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                  id="edit-email"
                  placeholder="Enter Email ..."
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="mt-5" />

            {/* Changing of roles is a radio button */}
            {/* User cannot edit their own role. 
            Radiogroup functionalities are disabled beforehand to prevent this. */}
            <div className="space-y-2">
              <Label id="edit-role-label">
                Role 
                {(roleLocked) ? " (Cannot edit self)" : ""}
              </Label>
              <RadioGroup
                  aria-labelledby="edit-role-label"
                  value={role}
                  onValueChange={(value) => setRole(value as "user" | "admin")}
                  className="flex gap-6"
                  disabled={roleLocked}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="user" id="edit-role-user" />
                  <Label htmlFor="edit-role-user">User</Label>
                </div>

                <div className="flex items-center gap-2">
                  <RadioGroupItem value="admin" id="edit-role-admin" />
                  <Label htmlFor="edit-role-admin">Admin</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="mt-5" />

            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (optional)</Label>
              <div className="relative">
                <Input
                    id="edit-password"
                    placeholder="Enter Password ..."
                    value={password}
                    type={showPassword ? "text" : "password"}
                    onChange={(event) => setPassword(event.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-900 hover:text-slate-700 bg-slate-100 hover:bg-slate-300"
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-3">
              <Button className="w-full" onClick={() => setConfirm(true)}>
                Edit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog to save changes */}
      <Dialog open={confirm} onOpenChange={() => {setConfirm(false); setError(null);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Details?</DialogTitle>
            <DialogDescription>Save the entered details?</DialogDescription>
          </DialogHeader>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex justify-center gap-3">
              <Button className="w-full" onClick={() => {/* Insert Edit Function Here */}} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
