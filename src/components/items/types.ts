import type { PublicItem } from "@/lib/items/types";

export type ItemProps<P = any, R = any, S = any> = {
  item: PublicItem & { data: P };
  value: R | null;
  onChange: (v: R) => void;
  /** server-side moves (lock); resolves with the reply */
  interact: (action: unknown) => Promise<any>;
  state: S | null;
  disabled?: boolean;
  /** called when a widget wants to report something (e.g. a tock run) to the integrity log */
  log?: (type: string, data?: Record<string, unknown>) => void;
};
