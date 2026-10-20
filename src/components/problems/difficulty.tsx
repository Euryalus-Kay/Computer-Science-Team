import { Badge } from "@/components/ui/badge";

export function Difficulty({ value }: { value: string }) {
  const tone = value === "easy" ? "green" : value === "medium" ? "amber" : "red";
  return <Badge tone={tone}>{value[0].toUpperCase() + value.slice(1)}</Badge>;
}
