"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setDeckPublished } from "@/lib/admin/decks";

export function DeckPublish({ id, published }: { id: string; published: boolean }) {
  const [on, setOn] = useState(published);
  const [, start] = useTransition();
  return (
    <Switch
      checked={on}
      label="Visible to members"
      onChange={(v) => {
        setOn(v);
        start(async () => {
          const r = await setDeckPublished(id, v);
          if (!r.ok) setOn(!v);
        });
      }}
    />
  );
}
