"use client";

import { useEffect, useState } from "react";
import { useNow } from "@/lib/use-now";
import { BoardScreen, type BoardPayload } from "./screen";
import { BoardControls, type Option } from "./controls";
import { useBoard } from "./board";

/** Drives the projector from another screen, with a live preview. */
export function BoardRemote({ initial, tests, decks }: { initial: BoardPayload; tests: Option[]; decks: Option[] }) {
  const { data, offset, refresh, patch, onPages } = useBoard(initial, 2000);
  const tick = useNow(500);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className="space-y-4">
      <div className="card p-3">
        <BoardControls data={data} tests={tests} decks={decks} patch={patch} refresh={refresh} />
      </div>
      <div className="max-w-[1040px] overflow-hidden rounded-xl border border-line shadow-card">
        <div className="aspect-video w-full">
          <BoardScreen data={data} now={tick === null ? null : tick + offset} origin={origin} preview onPages={onPages} />
        </div>
      </div>
    </div>
  );
}
