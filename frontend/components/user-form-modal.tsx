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

export function UserFormModal({ selectedUser }: {
  selectedUser: User;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const roleLocked = user?.id === selectedUser.id;

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState<string>(selectedUser.username);
  const [email, setEmail] = useState<string>(selectedUser.email);
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<"user" | "admin">(selectedUser.role);
  const [confirm, setConfirm] = useState(false);

  const handleCancel = () => {
    setUsername(selectedUser.username);
    setEmail(selectedUser.email);
    setPassword("");
    setRole(selectedUser.role);

    setOpen(false);
  }

  const handleEditConfirm = async () => {
    setError(null);
    setSaving(true);

    try {
      //EDIT LOGIC GOES HERE

      setConfirm(false);
      setOpen(false);
    } catch(err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
              <Input
                  id="edit-password"
                  placeholder="Enter Password ..."
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="mt-5 flex justify-center gap-3">
              <Button className="w-full" onClick={() => setConfirm(true)}>
                Edit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <Button className="w-full" onClick={handleEditConfirm} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
