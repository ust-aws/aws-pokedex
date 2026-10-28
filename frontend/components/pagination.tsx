"use client";

import { Button } from "@/components/ui/button";
import { Pagination as PaginationRoot, PaginationContent, PaginationItem } from "@/components/ui/pagination";

export function Pagination({ total, page, pageSize, onPageChange }: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <PaginationRoot>
      <PaginationContent className="gap-4">
        <PaginationItem><Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{"<"}</Button></PaginationItem>
        <PaginationItem><span aria-live="polite" className="text-sm">Page {page} of {pages}</span></PaginationItem>
        <PaginationItem><Button variant="outline" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>{">"}</Button></PaginationItem>
      </PaginationContent>
    </PaginationRoot>
  );
}
