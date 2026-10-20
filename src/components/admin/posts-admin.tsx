"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { deletePost, savePost, setPinned } from "@/lib/admin/posts";
import type { PostView } from "@/lib/posts";
import { MarkdownField } from "./tests/editor/fields";

export function PostsAdmin({ posts, timezone }: { posts: PostView[]; timezone: string }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [pinned, setPin] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (p: Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) =>
    start(async () => {
      const r = await p;
      if (!r.ok) return toast(r.error ?? "Something went wrong", "error");
      toast(done);
      after?.();
      router.refresh();
    });
  return (
    <div className="space-y-6">
      <div className="card p-4">
        <MarkdownField value={body} onChange={setBody} rows={4} placeholder="Practice moves to Room 214 on Thursday." />
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <Switch checked={pinned} onChange={setPin} label="Pin to top" /> Pin to top
          </label>
          <div className="flex gap-2">
            {editing && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setBody("");
                  setPin(false);
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              disabled={pending || !body.trim()}
              onClick={() =>
                run(savePost({ id: editing, body, pinned }), editing ? "Updated" : "Posted", () => {
                  setBody("");
                  setPin(false);
                  setEditing(null);
                })
              }
            >
              {editing ? "Save" : "Post"}
            </Button>
          </div>
        </div>
      </div>

      {posts.length > 0 && (
        <div className="card divide-y divide-line">
          {posts.map((p) => (
            <article key={p.id} className="group px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-ink-3">
                <span className="flex items-center gap-2">
                  {p.pinned && <Pin className="size-3.5 text-accent" />}
                  {p.author ?? "Admin"} · {formatDateTime(p.createdAt, timezone)}
                </span>
                <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => run(setPinned(p.id, !p.pinned), p.pinned ? "Unpinned" : "Pinned")}
                    className="rounded p-1.5 text-ink-3 hover:bg-panel-3 hover:text-ink"
                    aria-label={p.pinned ? "Unpin" : "Pin"}
                  >
                    {p.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(p.id);
                      setBody(p.body);
                      setPin(p.pinned);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded p-1.5 text-ink-3 hover:bg-panel-3 hover:text-ink"
                    aria-label="Edit"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => confirm("Delete this post?") && run(deletePost(p.id), "Deleted")}
                    className="rounded p-1.5 text-ink-3 hover:bg-red-soft hover:text-red"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
              <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
