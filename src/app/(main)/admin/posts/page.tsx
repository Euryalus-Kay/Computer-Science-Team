import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { postsForHome } from "@/lib/posts";
import { getSettings } from "@/lib/settings";
import { Page, PageHeader } from "@/components/ui/page";
import { PostsAdmin } from "@/components/admin/posts-admin";

export const metadata: Metadata = { title: "Posts" };

export default async function AdminPosts() {
  await requireAdmin();
  const [posts, settings] = await Promise.all([postsForHome(100), getSettings()]);
  return (
    <Page className="max-w-[820px]">
      <PageHeader title="Posts" meta={<span>Shown on everyone&apos;s home page</span>} />
      <PostsAdmin posts={posts} timezone={settings.timezone} />
    </Page>
  );
}
