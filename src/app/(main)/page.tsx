import { requireUser } from "@/lib/auth/session";
import { Page, PageHeader } from "@/components/ui/page";

export default async function Home() {
  const { user } = await requireUser();
  return (
    <Page>
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} />
    </Page>
  );
}
