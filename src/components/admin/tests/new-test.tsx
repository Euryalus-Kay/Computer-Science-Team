"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createTest } from "@/lib/admin/tests";

export function NewTestButton({ label = "New test" }: { label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      icon={<Plus className="size-4" />}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await createTest();
          if (!r.ok || !r.data) return toast(r.ok ? "Couldn't create the test" : r.error, "error");
          router.push(`/admin/tests/${r.data.id}/edit`);
        })
      }
    >
      {label}
    </Button>
  );
}
