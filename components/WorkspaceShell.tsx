"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  KeyRound,
  Menu,
  Plus,
  Search,
  Workflow,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { MotionToggle } from "@/components/MotionToggle";
import { useAccount } from "@/lib/hooks/useAccount";
import { LogOut, Settings } from "lucide-react";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { data: account } = useAccount();
  const pathname = usePathname(),
    canvas = /^\/workflows\/[^/]+$/.test(pathname);
  const [menuOpen, setMenuOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const section =
    pathname === "/settings"
      ? "Account"
      : pathname.startsWith("/workflows")
        ? "Workflows"
        : pathname === "/credentials"
          ? "Credentials"
          : pathname.includes("playground")
            ? "Playground"
            : pathname === "/"
              ? "Agents"
              : pathname.startsWith("/agents")
                ? "Agent studio"
                : "Workspace";
  const compact = canvas || collapsed;
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const openSearch = () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
  const signOut = async () => {
    const response = await fetch("/api/auth", { method: "DELETE" });
    if (response.ok) {
      try {
        localStorage.setItem("m4m-auth-event", String(Date.now()));
      } catch {}
      window.location.assign("/login");
    }
  };
  const links = [
    {
      href: "/workflows",
      label: "Workflows",
      icon: Workflow,
      active: pathname.startsWith("/workflows"),
    },
    {
      href: "/",
      label: "Agents",
      icon: Bot,
      active: pathname === "/" || pathname.startsWith("/agents"),
    },
    {
      href: "/credentials",
      label: "Credentials",
      icon: KeyRound,
      active: pathname === "/credentials",
    },
    {
      href: "/settings",
      label: "Account",
      icon: Settings,
      active: pathname === "/settings",
    },
  ];
  if (pathname === "/login" || pathname === "/register")
    return (
      <main className="m4m-auth">
        <div className="m4m-auth-brand-row">
          <Link href="/workflows" aria-label="m8m home">
            <Brand />
          </Link>
          <MotionToggle className="m4m-auth-motion" />
        </div>
        {children}
      </main>
    );
  return (
    <div
      className={`forge-workspace ${compact ? "is-compact" : ""} ${canvas ? "is-canvas" : ""}`}
    >
      <a href="#workspace-content" className="forge-skip">
        Skip to content
      </a>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          variant="navigation"
          className="m4m-mobile-navigation"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            menuTrigger.current?.focus();
          }}
        >
          <DialogTitle>
            <Brand />
          </DialogTitle>
          <DialogDescription>
            Your private automation workspace
          </DialogDescription>
          <nav aria-label="Mobile workspace navigation">
            {links.map(({ href, label, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                className={`forge-nav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            <button
              className="forge-nav-item"
              onClick={() => {
                setMenuOpen(false);
                openSearch();
              }}
            >
              <Search size={18} />
              Search workspace
            </button>
            <MotionToggle className="m4m-mobile-motion" />
            <button className="forge-nav-item" onClick={signOut}>
              <LogOut size={18} />
              Sign out
            </button>
          </nav>
        </DialogContent>
      </Dialog>
      <aside
        className={`forge-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="Workspace navigation"
      >
        <Link
          href="/workflows"
          className="forge-brand"
          aria-label="m8m home"
          onClick={() => setMenuOpen(false)}
        >
          <Brand compact={compact} />
        </Link>
        <div className="forge-workspace-picker" title="Personal workspace">
          <span className="forge-avatar">M</span>
          <span className="m4m-nav-label">
            <strong>{account?.name ?? "Your workspace"}</strong>
          </span>
        </div>
        <p className="forge-nav-label m4m-nav-label">Workspace</p>
        <nav className="m4m-navigation">
          {links.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={`forge-nav-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={16} />
              <span className="m4m-nav-label">{label}</span>
            </Link>
          ))}
          <button
            className="forge-nav-item"
            title="Search workspace (Ctrl K)"
            onClick={openSearch}
          >
            <Search size={16} />
            <span className="m4m-nav-label">Search</span>
            <kbd className="m4m-nav-label">Ctrl K</kbd>
          </button>
        </nav>
        <div className="m4m-sidebar-bottom">
          <Link
            href="/agents/new"
            className="m4m-sidebar-create"
            title="Create an agent"
          >
            <Plus size={17} />
            <span className="m4m-nav-label">Create an agent</span>
            <ArrowUpRight size={13} className="m4m-nav-label" />
          </Link>
          <div className="m4m-local-status">
            <span />
            <span className="m4m-nav-label">Private workspace</span>
          </div>
          <MotionToggle />
          <button
            className="forge-nav-item"
            aria-label="Sign out"
            title="Sign out"
            onClick={signOut}
          >
            <LogOut size={16} />
            <span className="m4m-nav-label">Sign out</span>
          </button>
          <button
            className="m4m-collapse"
            onClick={() => {
              setCollapsed((v) => !v);
              setMenuOpen(false);
            }}
            title={compact ? "Expand navigation" : "Collapse navigation"}
            aria-label={compact ? "Expand navigation" : "Collapse navigation"}
          >
            {compact ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
            <span className="m4m-nav-label">Collapse sidebar</span>
          </button>
        </div>
        <div className="forge-sidebar-footer">
          <span className="forge-avatar m4m-user">M</span>
          <div className="m4m-nav-label">
            <strong>{account?.name ?? "My workspace"}</strong>
            <small title={account?.email}>{account?.email}</small>
          </div>
        </div>
      </aside>
      <div className="forge-workspace-body">
        {!canvas && (
          <header className="forge-topbar">
            <div className="m4m-breadcrumb">
              <button
                ref={menuTrigger}
                className="m4m-mobile-menu"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <span>Personal</span>
              <ChevronRight size={13} />
              <strong>{section}</strong>
            </div>
            <button
              onClick={openSearch}
              className="forge-topbar-search"
              aria-label="Open command palette"
            >
              <Search size={14} />
              <span>Search workspace</span>
              <kbd>Ctrl K</kbd>
            </button>
          </header>
        )}
        {canvas && (
          <button
            ref={menuTrigger}
            className="m4m-canvas-mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
        )}
        <div id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
