/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { ListItem, ListItemLabel, ListItemLink } from "@makeplane/propel/elements/list";
import { ChevronDownOutline } from "@makeplane/propel/icons";
// plane imports
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
// components
import { KindIcon } from "@/components/products/kind-icon";
// services
import { ProductService } from "@/services/product.service";

const productService = new ProductService();

type TToggleProps = { projectName: string; isOpen: boolean; onToggle: () => void };

/** The chevron at the end of a project row that shows and hides the project's products. */
export function ProjectProductsToggle({ projectName, isOpen, onToggle }: TToggleProps) {
  const { t } = useTranslation();

  return (
    <IconButton
      variant="ghost"
      size="xs"
      icon={
        <Icon
          icon={<ChevronDownOutline className={cn("transition-transform duration-200", !isOpen && "-rotate-90")} />}
        />
      }
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={t("team_structure.project_products", { name: projectName })}
    />
  );
}

type TListProps = { projectId: string };

/** Products of one project, loaded when the list is first opened. Each one links to its work item page. */
export const ProjectProducts = observer(function ProjectProducts({ projectId }: TListProps) {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const { t } = useTranslation();
  const slug = workspaceSlug?.toString() ?? "";
  const { data: products, isLoading } = useSWR(slug ? `SIDEBAR_PROJECT_PRODUCTS_${slug}_${projectId}` : null, () =>
    productService.list(slug, { project_id: projectId })
  );

  if (isLoading && !products) return null;

  return (
    <div className="flex w-full flex-col gap-px pl-6">
      {products?.map((product) => {
        const href = `/${slug}/browse/${product.project_identifier}-${product.sequence_id}/`;
        return (
          <ListItem key={product.id} density="comfortable">
            <ListItemLink
              render={<Link href={href} />}
              aria-current={pathname.replace(/\/?$/, "/") === href ? "page" : undefined}
            >
              <KindIcon kind="product" />
              <ListItemLabel>{product.name}</ListItemLabel>
            </ListItemLink>
          </ListItem>
        );
      })}
      {products?.length === 0 && (
        <p className="px-2 py-1 text-caption-sm-regular text-placeholder">{t("product.no_products")}</p>
      )}
    </div>
  );
});
