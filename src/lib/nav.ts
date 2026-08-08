import type { ComponentType } from "react";
import {
  IconBriefing,
  IconDeploy,
  IconFix,
  IconOverview,
  IconProjects,
  IconRepo,
} from "../components/icons";

export type ScreenId =
  | "overview"
  | "projects"
  | "repo"
  | "fix"
  | "deploys"
  | "briefing";

export interface NavEntry {
  id: ScreenId;
  path: string;
  label: string;
  title: string;
  /** The build phase that makes this screen real. 1 = live now. */
  phase: number;
  icon: ComponentType<{ className?: string }>;
  blurb: string;
}

export const NAV: NavEntry[] = [
  {
    id: "overview",
    path: "/",
    label: "Overview",
    title: "The Wall",
    phase: 1,
    icon: IconOverview,
    blurb: "Every signal from every build, on one surface.",
  },
  {
    id: "projects",
    path: "/projects",
    label: "Projects",
    title: "Project Registry",
    phase: 2,
    icon: IconProjects,
    blurb: "One card per build — domain, stack, uptime, open issues, MRR.",
  },
  {
    id: "repo",
    path: "/repo",
    label: "Repo Console",
    title: "Repo Console",
    phase: 3,
    icon: IconRepo,
    blurb: "Browse trees, read files, diff, and open PRs. Never a push to main.",
  },
  {
    id: "fix",
    path: "/fix",
    label: "Fix Queue",
    title: "Fix Queue",
    phase: 4,
    icon: IconFix,
    blurb: "Errors grouped by fingerprint, ranked by user impact.",
  },
  {
    id: "deploys",
    path: "/deploys",
    label: "Deploys",
    title: "Deploys",
    phase: 6,
    icon: IconDeploy,
    blurb: "Trigger, stream, and roll back — each behind a confirmation.",
  },
  {
    id: "briefing",
    path: "/briefing",
    label: "Briefing",
    title: "Daily Briefing",
    phase: 7,
    icon: IconBriefing,
    blurb: "What shipped, what broke, what users asked for, what to do next.",
  },
];

export const PHASES: { n: number; label: string }[] = [
  { n: 1, label: "Auth, owner allowlist, shell, animated core" },
  { n: 2, label: "Project registry + manual metrics" },
  { n: 3, label: "GitHub read + repo console" },
  { n: 4, label: "Metrics, error ingest, fix queue" },
  { n: 5, label: "AI assistant with read-only tools" },
  { n: 6, label: "Write actions: PRs, deploys, rollback" },
  { n: 7, label: "Daily briefing + voice mode" },
];

/** Phases that are complete and shipped. */
export const SHIPPED_THROUGH = 1;

export function entryForPath(pathname: string): NavEntry {
  return NAV.find((n) => n.path === pathname) ?? NAV[0];
}
