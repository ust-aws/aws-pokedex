"use client"

import { useState } from "react";
import { UserFormModal } from "@/components/user-form-modal";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { api, ApiError } from "@/lib/api";

type User = {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  createdAt: string;
};

export function UserTable({ users }: { users: User[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-slate-300 bg-white min-[1040px]:block">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-slate-900">
            <tr>
            <th className="border-r border-slate-300 px-3 py-2 text-xs font-semibold uppercase">
                Username
            </th>
            <th className="border-r border-slate-300 px-3 py-2 text-xs font-semibold uppercase">
                Email
            </th>
            <th className="border-r border-slate-300 px-3 py-2 text-xs font-semibold uppercase">
                Role
            </th>
            <th className="border-r border-slate-300 px-3 py-2 text-xs font-semibold uppercase">
                Created
            </th>
            <th className="px-3 py-2 text-xs font-semibold uppercase">
                Action
            </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
            <tr 
                key={u.id}
                className="border-t border-slate-200 text-slate-800"
            >
                <td className="border-r border-slate-200 px-3 py-2 text-xs font-medium">
                {u.username}
                </td>
                <td className="border-r border-slate-200 px-3 py-2 text-xs">
                {u.email}
                </td>
                <td className="border-r border-slate-200 px-3 py-2 text-xs">
                {u.role}
                </td>
                <td className="border-r border-slate-200 px-3 py-2 text-xs">
                {
                  new Date(u.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                }
                </td>
                <td className="px-3 py-1">
                  <div className="flex justify-center gap-3">
                    <UserFormModal selectedUser={u} />
                    <DeleteUserModal selectedUser={u} />
                  </div>
                </td>
            </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

function DeleteUserModal({selectedUser} : {
  selectedUser: User;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setActionError(null);

    try {
      //DELETE LOGIC GOES HERE

      setOpen(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete the user.");
    } finally {
      setDeleting(false);
    }
  }

  if(selectedUser.id === user?.id) return;

  return (
    <div>
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
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </Button>

      <Modal
        open={open}
        onOpenChange={() => {setOpen(false); setActionError(null);}}
        title={"Delete user?"}
        description={"You cannot undo this action."}
        children={(
          <div className="flex flex-col gap-2">
            {actionError && <p role="alert" className="mb-2 text-sm text-red-600">{actionError}</p>}
            <Button className="bg-rose-600 hover:bg-rose-400" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Confirm"}
            </Button>
          </div>
        )}
      / >
    </div>
  )
}