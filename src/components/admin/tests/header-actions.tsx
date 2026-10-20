"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MonitorPlay, MoreHorizontal, Copy, Archive, Trash2, ExternalLink, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteTest, duplicateTest, setTestStatus } from "@/lib/admin/tests";

export function TestHeaderActions({ id, slug, status, title }: { id: string; slug: string; status: string; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function preview() {
    setBusy(true);
    const res = await fetch(`/api/tests/${id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preview: true }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(j.error ?? "Couldn't open a preview", "error");
    window.open(`/take/${j.attemptId}`, "_blank");
  }

  async function board() {
    const res = await fetch("/api/board/state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ view: "test", contestId: id }),
    });
    toast(res.ok ? "Showing on the board" : "Couldn't update the board", res.ok ? "default" : "error");
  }

  return (
    <>
      <Button icon={<Eye className="size-4" />} onClick={preview} disabled={busy}>
        Preview
      </Button>
      <Button icon={<MonitorPlay className="size-4" />} onClick={board}>
        Show on board
      </Button>
      <Menu
        trigger={({ toggle }) => (
          <Button onClick={toggle} aria-label="More" className="px-2">
            <MoreHorizontal className="size-4" />
          </Button>
        )}
      >
        {(close) => (
          <>
            <MenuItem icon={<ExternalLink />} onClick={() => (close(), window.open(`/tests/${slug}`, "_blank"))}>
              Open lobby
            </MenuItem>
            <MenuItem icon={<MonitorPlay />} onClick={() => (close(), window.open(`/board`, "_blank"))}>
              Open board
            </MenuItem>
            <MenuItem
              icon={<Copy />}
              onClick={async () => {
                close();
                const r = await duplicateTest(id);
                if (r.ok && r.data) router.push(`/admin/tests/${r.data.id}/edit`);
                else toast(r.ok ? "Couldn't duplicate" : r.error, "error");
              }}
            >
              Duplicate
            </MenuItem>
            <MenuSeparator />
            {status === "archived" ? (
              <MenuItem icon={<ArchiveRestore />} onClick={async () => (close(), await setTestStatus(id, "draft"), router.refresh())}>
                Restore as draft
              </MenuItem>
            ) : (
              <MenuItem icon={<Archive />} onClick={async () => (close(), await setTestStatus(id, "archived"), router.refresh())}>
                Archive
              </MenuItem>
            )}
            <MenuItem danger icon={<Trash2 />} onClick={() => (close(), setConfirmDelete(true))}>
              Delete
            </MenuItem>
          </>
        )}
      </Menu>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this test?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteTest(id);
                router.push("/admin/tests");
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          <b className="text-ink">{title}</b> and every attempt, answer and integrity log for it will be removed. Archiving keeps the results.
        </p>
      </Dialog>
    </>
  );
}
