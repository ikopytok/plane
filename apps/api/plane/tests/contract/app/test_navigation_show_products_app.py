# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the personal "show products in the sidebar" navigation setting."""

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import User, WorkspaceMember

URL = "/api/workspaces/{slug}/user-properties/"


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.contract
@pytest.mark.django_db
class TestNavigationShowProducts:
    def test_off_by_default(self, workspace, create_user):
        response = _client(create_user).get(URL.format(slug=workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["navigation_show_products"] is False

    def test_patch_saves_it_for_the_caller_only(self, workspace, create_user):
        unique = uuid4().hex[:8]
        other = User.objects.create(email=f"nav-{unique}@plane.so", username=f"nav_{unique}")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=15, is_active=True)

        response = _client(create_user).patch(
            URL.format(slug=workspace.slug), {"navigation_show_products": True}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["navigation_show_products"] is True

        assert _client(create_user).get(URL.format(slug=workspace.slug)).data["navigation_show_products"] is True
        assert _client(other).get(URL.format(slug=workspace.slug)).data["navigation_show_products"] is False
