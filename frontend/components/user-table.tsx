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

//Table showing the actual list of users
export function UserTable({ users }: { users: User[] }) {
  return (
    <>
      {/* Responsive design for mobile phones and devices under 1024-px width */}
      <ul className="space-y-3 lg:hidden">
        {users.map((u) => (
          <li key={u.id} className="rounded-md border border-slate-300 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{u.username}</p>
                <p className="break-all text-sm text-slate-600">{u.email}</p>
              </div>
              <div className="flex flex-cols-1 gap-3">
                  <UserFormModal selectedUser={u} />
                  <DeleteUserModal selectedUser={u} />
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">Role</dt>
                <dd className="mt-0.5 font-medium capitalize text-slate-800">{u.role}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="mt-0.5 text-slate-800">
                  { new Date(u.createdAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                  }) }
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Original table view for devices with 1024-px width or more */}
      <div className="hidden overflow-x-auto rounded-md border border-slate-300 bg-white lg:block">
          <table className="w-full border-collapse text-left text-sm">
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
              <th className="sticky right-0 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase">
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
                  <td className="sticky right-0 bg-white px-3 py-1">
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
    </>
  );
}

//Modal to delete the user
function DeleteUserModal({selectedUser} : {
  selectedUser: User;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  //Actual function for soft deletion (Disabled)
  //Remove comment tags or create a new function when implementing backend
  /* const handleDelete = async () => {
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
  } */

  //Prevents the user from deleting their own account by not displaying the delete button if
  //the conditions are right.
  if(selectedUser.id === user?.id) return;

  return (
    <div>
      {/* Actual delete button */}
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

      {/* Confirmation modal for deletion */}
      <Modal
        open={open}
        onOpenChange={() => {setOpen(false); setActionError(null);}}
        title={"Delete user?"}
        description={"You cannot undo this action."}
      >
        <div className="flex flex-col gap-2">
          {actionError && <p role="alert" className="mb-2 text-sm text-red-600">{actionError}</p>}
          <Button className="bg-rose-600 hover:bg-rose-400" onClick={() => { /* Insert Delete Function Here */ }} disabled={deleting}>
            {deleting ? "Deleting..." : "Confirm"}
          </Button>
        </div>
      </Modal>
    </div>
  )
}