/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsiblePanelContent,
  CollapsibleTriggerTrailing,
} from "@makeplane/propel/components/collapsible";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { ListItem, ListItemLabel, ListItemLink } from "@makeplane/propel/elements/list";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { AddOutline, BoardOutline, ChevronDownOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
// plane imports
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TPortfolio, TProject, TTeam } from "@plane/types";
import { cn, copyUrlToClipboard } from "@plane/utils";
// components
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { EntityFormDialog } from "@/components/teams/entity-form-dialog";
import { useTeamAction } from "@/components/teams/use-team-action";
// hooks
import { useTeam } from "@/hooks/store/use-team";
import useLocalStorage from "@/hooks/use-local-storage";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
// local imports
import { ProjectProducts, ProjectProductsToggle } from "./project-products";
import { SidebarProjectsListItem } from "./projects-list-item";
import type { TTreeSelection } from "./tree-selection";
import { TreeSelectionProvider, treeLevelClass, useTreeSelection } from "./tree-selection";

/** The ancestors of a tree node: its team and portfolio, when it has them. */
type TTreeParent = Pick<TTreeSelection, "teamId" | "portfolioId">;

type TProjectRowProps = { project: TProject; parent: TTreeParent; isLastChild: boolean; onCopyLink: () => void };

/** A joined project in the tree; with the "show products" preference it also gets a toggle for its products. */
const TreeProjectRow = observer(function TreeProjectRow({
  project,
  parent,
  isLastChild,
  onCopyLink,
}: TProjectRowProps) {
  const { workspaceSlug } = useParams();
  const { select, isInChain, isLast } = useTreeSelection();
  const {
    preferences: { showProducts },
  } = useProjectNavigationPreferences();
  const { storedValue: isOpen, setValue: setIsOpen } = useLocalStorage<boolean>(
    `sidebar_project_${project.id}_products_open`,
    false
  );

  return (
    <>
      <SidebarProjectsListItem
        projectId={project.id}
        handleCopyText={onCopyLink}
        projectListType="JOINED"
        disableDrag
        disableDrop
        isLastChild={isLastChild}
        isCurrent={isLast("project", project.id)}
        labelClassName={treeLevelClass("project", isInChain("project", project.id))}
        onSelect={() =>
          select({
            ...parent,
            projectId: project.id,
            href: `/${workspaceSlug}/projects/${project.id}/`,
            isPrefix: true,
          })
        }
        trailing={
          showProducts ? (
            <ProjectProductsToggle projectName={project.name} isOpen={!!isOpen} onToggle={() => setIsOpen(!isOpen)} />
          ) : undefined
        }
      />
      {showProducts && isOpen && <ProjectProducts projectId={project.id} parent={parent} />}
    </>
  );
});

type TProjectsProps = { projects: TProject[]; parent: TTreeParent };

const TreeProjects = observer(function TreeProjects({ projects, parent }: TProjectsProps) {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { select, isInChain, isLast } = useTreeSelection();

  const handleCopyText = (projectId: string) => {
    void copyUrlToClipboard(`${workspaceSlug}/projects/${projectId}/issues`).then(() =>
      setToast({ type: "success", title: t("link_copied"), message: t("project_link_copied_to_clipboard") })
    );
  };

  return (
    <>
      {projects.map((project, index) =>
        project.member_role ? (
          <TreeProjectRow
            key={project.id}
            project={project}
            parent={parent}
            isLastChild={index === projects.length - 1}
            onCopyLink={() => handleCopyText(project.id)}
          />
        ) : (
          <ListItem key={project.id} density="comfortable">
            <ListItemLink
              render={
                <Link
                  href={`/${workspaceSlug}/projects/${project.id}/issues`}
                  onClick={() =>
                    select({
                      ...parent,
                      projectId: project.id,
                      href: `/${workspaceSlug}/projects/${project.id}/`,
                      isPrefix: true,
                    })
                  }
                />
              }
              aria-current={isLast("project", project.id) ? "page" : undefined}
            >
              <Logo logo={project.logo_props} size={16} />
              <ListItemLabel render={<span className={treeLevelClass("project", isInChain("project", project.id))} />}>
                {project.name}
              </ListItemLabel>
            </ListItemLink>
          </ListItem>
        )
      )}
    </>
  );
});

type TNodeMenuProps = { label: string; children: ReactNode };

/** Three-dots menu of a tree node. Always in the tab order, so it is reachable without a mouse. */
function NodeMenu({ label, children }: TNodeMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton variant="ghost" size="xs" icon={<Icon icon={MoreHorizontalOutline} />} aria-label={label} />
        }
      />
      <MenuContent side="bottom" align="start">
        {children}
      </MenuContent>
    </Menu>
  );
}

type TPortfolioNodeProps = { portfolio: TPortfolio };

const PortfolioNode = observer(function PortfolioNode({ portfolio }: TPortfolioNodeProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { workspaceSlug } = useParams();
  const router = useRouter();
  const { canManageTeam, getPortfolioProjects } = useTeam();
  const { t } = useTranslation();
  const { storedValue: isOpen, setValue: setIsOpen } = useLocalStorage<boolean>(
    `sidebar_portfolio_${portfolio.id}_open`,
    true
  );
  const { select, isInChain, isLast } = useTreeSelection();
  const projects = getPortfolioProjects(portfolio.id);
  const href = `/${workspaceSlug?.toString()}/portfolios/${portfolio.id}`;
  const parent: TTreeParent = { teamId: portfolio.team, portfolioId: portfolio.id };
  const isCurrent = isLast("portfolio", portfolio.id);
  const handleSelect = () => select({ ...parent, href });

  return (
    <>
      {workspaceSlug && (
        <CreateProjectModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          workspaceSlug={workspaceSlug.toString()}
          data={{ portfolio_id: portfolio.id }}
        />
      )}
      {/* the name opens the portfolio page and shows its projects; the chevron alone shows and hides them */}
      <BaseCollapsible.Root open={!!isOpen} onOpenChange={setIsOpen} className="w-full">
        <CollapsibleHeader
          placement="sidebar"
          render={<div className={cn(isCurrent && "bg-layer-transparent-selected")} />}
        >
          <Link
            href={href}
            onClick={() => {
              setIsOpen(true);
              handleSelect();
            }}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "col-start-1 row-start-1 flex h-8 min-w-0 items-center truncate",
              treeLevelClass("portfolio", isInChain("portfolio", portfolio.id))
            )}
          >
            <span className="truncate">{portfolio.name}</span>
          </Link>
          <CollapsibleTriggerTrailing placement="sidebar">
            <NodeMenu label={`${t("aria_labels.common.more_actions")}: ${portfolio.name}`}>
              <MenuItem
                label={t("common.overview")}
                onClick={() => {
                  handleSelect();
                  router.push(href);
                }}
              />
              {canManageTeam(portfolio.team) && (
                <MenuItem label={t("create_project")} onClick={() => setIsCreateOpen(true)} />
              )}
            </NodeMenu>
          </CollapsibleTriggerTrailing>
          <div className="col-start-3 row-start-1 flex items-center">
            <BaseCollapsible.Trigger
              render={
                <IconButton
                  variant="ghost"
                  size="xs"
                  icon={
                    <Icon
                      icon={
                        <ChevronDownOutline
                          className={cn("transition-transform duration-200", !isOpen && "-rotate-90")}
                        />
                      }
                    />
                  }
                  aria-label={t("team_structure.portfolio_projects", { name: portfolio.name })}
                />
              }
            />
          </div>
        </CollapsibleHeader>
        <BaseCollapsible.Panel render={<CollapsiblePanel />}>
          <CollapsiblePanelContent placement="sidebar">
            <div className="flex w-full flex-col gap-px pl-2">
              <TreeProjects projects={projects} parent={parent} />
              {projects.length === 0 && (
                <p className="px-2 py-1 text-caption-sm-regular text-placeholder">{t("team_structure.no_projects")}</p>
              )}
            </div>
          </CollapsiblePanelContent>
        </BaseCollapsible.Panel>
      </BaseCollapsible.Root>
    </>
  );
});

type TBoardLinkProps = { teamId?: string };

const BoardLink = observer(function BoardLink({ teamId }: TBoardLinkProps) {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { select, isInChain, isLast } = useTreeSelection();
  const href = `/${workspaceSlug?.toString()}/product-board`;

  return (
    <ListItem density="comfortable">
      <ListItemLink
        href={href}
        render={<Link href={href} onClick={() => select({ teamId, board: true, href })} />}
        aria-current={isLast("board") ? "page" : undefined}
      >
        <BoardOutline className="size-4 shrink-0" />
        <ListItemLabel render={<span className={treeLevelClass("portfolio", isInChain("board"))} />}>
          {t("product_board.title")}
        </ListItemLabel>
      </ListItemLink>
    </ListItem>
  );
});

type TTeamNodeProps = { team: TTeam };

const TeamNode = observer(function TeamNode({ team }: TTeamNodeProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { workspaceSlug } = useParams();
  const router = useRouter();
  const { canManageTeam, canSeeProductBoard, createPortfolio, getTeamPortfolios } = useTeam();
  const run = useTeamAction();
  const { t } = useTranslation();
  // the user's own teams start open
  const { storedValue: isOpen, setValue: setIsOpen } = useLocalStorage<boolean>(
    `sidebar_team_${team.id}_open`,
    !!team.member_role
  );
  const portfolios = getTeamPortfolios(team.id, false);
  const { select, isInChain, isLast } = useTreeSelection();
  const teamHref = `/${workspaceSlug}/teams/${team.id}`;

  return (
    <>
      <EntityFormDialog
        isOpen={isCreateOpen}
        title={t("team_structure.create_portfolio")}
        submitLabel={t("team_structure.create_portfolio")}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(values) => run(() => createPortfolio(workspaceSlug?.toString() ?? "", team.id, values))}
      />
      <Collapsible
        placement="sidebar"
        open={!!isOpen}
        onOpenChange={setIsOpen}
        // the header is the root's first child: it gets the selected background when the team page was opened here
        render={<div className={cn(isLast("team", team.id) && "[&>:first-child]:bg-layer-transparent-selected")} />}
        trigger={<span className={`truncate ${treeLevelClass("team", isInChain("team", team.id))}`}>{team.name}</span>}
        trailing={
          <NodeMenu label={`${t("aria_labels.common.more_actions")}: ${team.name}`}>
            <MenuItem
              label={t("common.overview")}
              onClick={() => {
                select({ teamId: team.id, href: teamHref });
                router.push(teamHref);
              }}
            />
            {team.kind === "management" && canSeeProductBoard && (
              <MenuItem
                label={t("product_board.title")}
                onClick={() => router.push(`/${workspaceSlug}/product-board`)}
              />
            )}
            {team.kind === "regular" && canManageTeam(team.id) && (
              <MenuItem label={t("team_structure.create_portfolio")} onClick={() => setIsCreateOpen(true)} />
            )}
          </NodeMenu>
        }
      >
        <div className="flex w-full flex-col gap-px pl-2">
          {team.kind === "management" && canSeeProductBoard && <BoardLink teamId={team.id} />}
          {portfolios.map((portfolio) => (
            <PortfolioNode key={portfolio.id} portfolio={portfolio} />
          ))}
          {portfolios.length === 0 && team.kind === "regular" && (
            <p className="px-2 py-1 text-caption-sm-regular text-placeholder">{t("team_structure.no_portfolios")}</p>
          )}
        </div>
      </Collapsible>
    </>
  );
});

/** Sidebar navigation of workspaces that use the team structure: team, portfolio, project. */
export const SidebarTeamsTree = observer(function SidebarTeamsTree() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { workspaceSlug } = useParams();
  const { activeTeams, unassignedProjects, canCreateProject, canSeeProductBoard } = useTeam();
  const { t } = useTranslation();
  const ownUnassigned = unassignedProjects.filter((project) => !!project.member_role);

  return (
    <TreeSelectionProvider>
      <div className="flex flex-col gap-1">
        {workspaceSlug && (
          <CreateProjectModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            setToFavorite={false}
            workspaceSlug={workspaceSlug.toString()}
          />
        )}
        {/* admins see the board before there is a management team to show it in */}
        {canSeeProductBoard && !activeTeams.some((team) => team.kind === "management") && <BoardLink />}
        <div className="flex items-center justify-between px-2 py-1">
          <span className={treeLevelClass("root", true)}>{t("team_structure.teams")}</span>
          {canCreateProject && (
            <Tooltip label={t("create_project")}>
              <IconButton
                variant="ghost"
                size="xs"
                showTooltip={false}
                icon={<Icon icon={AddOutline} />}
                onClick={() => setIsCreateOpen(true)}
                aria-label={t("aria_labels.projects_sidebar.create_new_project")}
              />
            </Tooltip>
          )}
        </div>
        {activeTeams.map((team) => (
          <TeamNode key={team.id} team={team} />
        ))}
        {ownUnassigned.length > 0 && (
          <div className="pt-2">
            <p className="px-2 py-1 text-body-xs-semibold text-tertiary">{t("team_structure.without_portfolio")}</p>
            <TreeProjects projects={ownUnassigned} parent={{}} />
          </div>
        )}
      </div>
    </TreeSelectionProvider>
  );
});
