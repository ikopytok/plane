/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** One node of the teams tree, as clicked: its ancestors, the node itself, and the page it opened. */
export type TTreeSelection = {
  teamId?: string;
  portfolioId?: string;
  board?: boolean;
  projectId?: string;
  productId?: string;
  /** The page the click opened. A project stays selected on any of its pages, so for one it is a prefix. */
  href: string;
  isPrefix?: boolean;
};

export type TTreeNodeKind = "team" | "portfolio" | "board" | "project" | "product";

type TTreeSelectionContext = {
  select: (selection: TTreeSelection) => void;
  /** The node is on the clicked path: shown in bold. */
  isInChain: (kind: TTreeNodeKind, id?: string) => boolean;
  /** The node is the one that was clicked: shown with the selected background. */
  isLast: (kind: TTreeNodeKind, id?: string) => boolean;
};

const STORAGE_KEY = "sidebar_teams_tree_selection";
/** Deepest first: the deepest node set in a selection is the one that was clicked. */
const KIND_DEEPEST_FIRST: TTreeNodeKind[] = ["product", "project", "board", "portfolio", "team"];

const withSlash = (path: string) => path.replace(/\/?$/, "/");

const nodeId = (selection: TTreeSelection, kind: TTreeNodeKind): string | undefined => {
  switch (kind) {
    case "team":
      return selection.teamId;
    case "portfolio":
      return selection.portfolioId;
    case "board":
      return selection.board ? "board" : undefined;
    case "project":
      return selection.projectId;
    case "product":
      return selection.productId;
  }
};

const readStored = (): TTreeSelection | null => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TTreeSelection) : null;
  } catch {
    return null;
  }
};

const TreeSelectionContext = createContext<TTreeSelectionContext>({
  select: () => {},
  isInChain: () => false,
  isLast: () => false,
});

/**
 * Remembers the last node clicked in the teams tree for this browser tab. The path to it is highlighted only while
 * the page it opened is still open, so a page reached from elsewhere (a dashboard, a link) leaves the tree as it is.
 */
export function TreeSelectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [selection, setSelection] = useState<TTreeSelection | null>(null);

  useEffect(() => setSelection(readStored()), []);

  const select = useCallback((next: TTreeSelection) => {
    setSelection(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage may be unavailable (private mode); the highlight then lasts until reload
    }
  }, []);

  const value = useMemo<TTreeSelectionContext>(() => {
    const current = withSlash(pathname ?? "");
    const target = selection ? withSlash(selection.href) : "";
    const isOpen = !!selection && (selection.isPrefix ? current.startsWith(target) : current === target);
    const active = isOpen ? selection : null;
    const lastKind = active ? KIND_DEEPEST_FIRST.find((kind) => nodeId(active, kind)) : undefined;

    return {
      select,
      isInChain: (kind, id = "board") => !!active && nodeId(active, kind) === id,
      isLast: (kind, id = "board") => !!active && lastKind === kind && nodeId(active, kind) === id,
    };
  }, [pathname, selection, select]);

  return <TreeSelectionContext.Provider value={value}>{children}</TreeSelectionContext.Provider>;
}

export const useTreeSelection = () => useContext(TreeSelectionContext);

const LEVEL_STYLE = {
  root: "text-16 text-primary",
  team: "text-15 text-[color-mix(in_oklch,var(--txt-primary),var(--txt-secondary))]",
  portfolio: "text-14 text-secondary",
  project: "text-13 text-[color-mix(in_oklch,var(--txt-secondary),var(--txt-tertiary))]",
  product: "text-12 text-tertiary",
} as const;

/**
 * Text style of each tree level: one step smaller and slightly lighter per level; the clicked path is semibold.
 * Join it with a template string, not `cn`: tailwind-merge takes `text-15` and an arbitrary colour for one group
 * and drops the size.
 */
export const treeLevelClass = (level: keyof typeof LEVEL_STYLE, isBold: boolean) =>
  // 400 and 600 as the spec asks; propel's "regular" is 450, so the weights are set directly
  `${LEVEL_STYLE[level]} leading-[1.54] ${isBold ? "font-semibold" : "font-[400]"}`;
