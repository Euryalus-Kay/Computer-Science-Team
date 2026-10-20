"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  House,
  ListChecks,
  CodeXml,
  Target,
  SquareTerminal,
  Presentation,
  Trophy,
  Gauge,
  Users,
  Megaphone,
  ScanEye,
  MonitorPlay,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu as MenuIcon,
  LogOut,
  Moon,
  Sun,
  Monitor,
  ChevronsUpDown,
  KeyRound,
  X,
  Timer,
  Laptop,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark } from "./logo";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { applyTheme, type ThemePref } from "./theme";
import { useNow } from "@/lib/use-now";

type Item = { href: string; label: string; icon: ComponentType<{ className?: string }>; match?: string; external?: boolean };

const MAIN: Item[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/tests", label: "Tests", icon: ListChecks },
  { href: "/problems", label: "Problems", icon: CodeXml },
  { href: "/drills", label: "Drills", icon: Target },
  { href: "/playground", label: "Playground", icon: SquareTerminal },
  { href: "/slides", label: "Slides", icon: Presentation },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const ADMIN: Item[] = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/tests", label: "Tests", icon: ListChecks },
  { href: "/admin/problems", label: "Problems", icon: CodeXml },
  { href: "/admin/slides", label: "Slides", icon: Presentation },
  { href: "/admin/posts", label: "Posts", icon: Megaphone },
  { href: "/admin/integrity", label: "Integrity", icon: ScanEye },
  { href: "/board", label: "Board", icon: MonitorPlay, external: true },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

export type ShellUser = { name: string; username: string; role: "admin" | "member" };
export type ActiveAttempt = { id: string; title: string; deadline: number | null } | null;

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(href + "/");
}

function NavLink({ item, path, collapsed, onNavigate }: { item: Item; path: string; collapsed: boolean; onNavigate?: () => void }) {
  const active = isActive(path, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md text-sm transition-colors duration-75",
        collapsed ? "justify-center px-0" : "px-2.5",
        active ? "bg-panel-3 font-medium text-ink" : "text-ink-2 hover:bg-panel-3/70 hover:text-ink",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-3 group-hover:text-ink-2")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function Countdown({ deadline }: { deadline: number }) {
  const now = useNow(1000);
  if (now === null) return null;
  const s = Math.max(0, Math.floor((deadline - now) / 1000));
  const m = Math.floor(s / 60);
  return (
    <span className="num font-mono">
      {m}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

function SidebarBody({
  user,
  siteName,
  collapsed,
  setCollapsed,
  active,
  onNavigate,
  mobile,
}: {
  user: ShellUser;
  siteName: string;
  collapsed: boolean;
  setCollapsed?: (v: boolean) => void;
  active: ActiveAttempt;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemePref>("system");
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )lcs_theme=([^;]+)/);
    setTheme((m?.[1] as ThemePref) ?? "system");
  }, []);
  const pickTheme = (t: ThemePref) => {
    setTheme(t);
    applyTheme(t);
  };
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-[52px] shrink-0 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 text-ink">
          <LogoMark size={22} />
          {!collapsed && <span className="text-[14.5px] font-semibold tracking-[-0.01em]">{siteName}</span>}
        </Link>
        {!collapsed && setCollapsed && !mobile && (
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-ink-4 hover:bg-panel-3 hover:text-ink-2"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto pb-3", collapsed ? "px-2" : "px-3")}>
        {active && (
          <Link
            href={`/take/${active.id}`}
            onClick={onNavigate}
            title={collapsed ? "Resume test" : undefined}
            className={cn(
              "mb-3 flex items-center gap-2 rounded-md border border-accent/25 bg-accent-soft text-accent-ink hover:border-accent/50",
              collapsed ? "h-8 justify-center" : "px-2.5 py-2",
            )}
          >
            <Timer className="size-4 shrink-0" />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{active.title}</span>
                <span className="block text-xs opacity-80">
                  Resume{active.deadline ? <> · <Countdown deadline={active.deadline} /> left</> : null}
                </span>
              </span>
            )}
          </Link>
        )}
        <div className="space-y-px">
          {MAIN.map((i) => (
            <NavLink key={i.href} item={i} path={path} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        {user.role === "admin" && (
          <>
            {collapsed ? (
              <div className="mx-auto my-3 h-px w-5 bg-line" />
            ) : (
              <div className="mt-5 mb-1.5 px-2.5 text-xs font-medium text-ink-4">Manage</div>
            )}
            <div className="space-y-px">
              {ADMIN.map((i) => (
                <NavLink key={i.href} item={i} path={path} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </>
        )}
      </nav>

      <div className={cn("shrink-0 border-t border-line", collapsed ? "p-2" : "p-2.5")}>
        {collapsed && setCollapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mb-1 flex h-8 w-full items-center justify-center rounded-md text-ink-3 hover:bg-panel-3 hover:text-ink"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        <Menu
          side="top"
          align="start"
          className="w-[220px]"
          trigger={({ toggle }) => (
            <button
              onClick={toggle}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md text-left hover:bg-panel-3",
                collapsed ? "h-9 justify-center" : "h-10 px-2",
              )}
            >
              <Avatar name={user.name} size={24} />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-tight">{user.name}</span>
                    <span className="block truncate text-xs leading-tight text-ink-3">@{user.username}</span>
                  </span>
                  <ChevronsUpDown className="size-3.5 text-ink-4" />
                </>
              )}
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2 pt-1.5 pb-2">
                <div className="mb-1.5 text-xs text-ink-3">Theme</div>
                <div className="grid grid-cols-3 gap-1 rounded-md bg-panel-3 p-0.5">
                  {(
                    [
                      ["light", Sun],
                      ["dark", Moon],
                      ["system", Monitor],
                    ] as const
                  ).map(([t, Icon]) => (
                    <button
                      key={t}
                      onClick={() => pickTheme(t)}
                      className={cn(
                        "flex h-6 items-center justify-center rounded-[5px] text-ink-3",
                        theme === t && "bg-panel text-ink shadow-card",
                      )}
                      aria-label={t}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <MenuSeparator />
              <MenuItem
                icon={<KeyRound />}
                onClick={() => {
                  close();
                  onNavigate?.();
                  router.push("/account");
                }}
              >
                Account
              </MenuItem>
              <MenuItem
                icon={<Laptop />}
                onClick={() => {
                  close();
                  onNavigate?.();
                  router.push("/app");
                }}
              >
                Desktop app
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<LogOut />} onClick={signOut}>
                Sign out
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}

export function Sidebar({
  user,
  siteName,
  initialCollapsed,
  active,
}: {
  user: ShellUser;
  siteName: string;
  initialCollapsed: boolean;
  active: ActiveAttempt;
}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();
  useEffect(() => setDrawer(false), [path]);
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    document.cookie = `lcs_nav=${v ? "collapsed" : "open"};path=/;max-age=31536000;samesite=lax`;
  };
  return (
    <>
      {/* desktop */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-panel transition-[width] duration-150 lg:block",
          collapsed ? "w-[56px]" : "w-[228px]",
        )}
      >
        <SidebarBody user={user} siteName={siteName} collapsed={collapsed} setCollapsed={setCollapsed} active={active} />
      </aside>

      {/* mobile top bar */}
      <div className="no-print sticky top-0 z-40 flex h-12 items-center justify-between border-b border-line bg-panel/95 px-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={20} />
          <span className="text-sm font-semibold">{siteName}</span>
        </Link>
        <button onClick={() => setDrawer(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-panel-3" aria-label="Open menu">
          <MenuIcon className="size-5" />
        </button>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <div className="animate-in absolute inset-y-0 left-0 w-[264px] border-r border-line bg-panel shadow-pop">
            <button
              onClick={() => setDrawer(false)}
              className="absolute top-3 right-3 z-10 rounded p-1 text-ink-3 hover:bg-panel-3"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            <SidebarBody
              user={user}
              siteName={siteName}
              collapsed={false}
              active={active}
              onNavigate={() => setDrawer(false)}
              mobile
            />
          </div>
        </div>
      )}
    </>
  );
}
