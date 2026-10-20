"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { setProblemPublished } from "@/lib/admin/problems";

export function PublishToggle({ id, published, kind }: { id: string; published: boolean; kind: "problem" }) {
  const [on, setOn] = useState(published);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <Switch
      checked={on}
      label="Visible in practice"
      onChange={(v) => {
        setOn(v);
        start(async () => {
          if (kind === "problem") await setProblemPublished(id, v);
          router.refresh();
        });
      }}
    />
  );
}
