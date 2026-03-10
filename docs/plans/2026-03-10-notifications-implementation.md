# Internal Notifications Implementation Plan

## Overview
Implement an internal notifications system for WrapIQ that allows in-app notifications for users within an organization. Notifications are tenant-scoped, user-targeted, and support read/unread status.

**Related issue:** #8 (Internal Notifications)

## Tasks

### Task 1: Notification Model
Create `backend/app/models/notification.py` with:
- `Notification(Base, TenantMixin, TimestampMixin)` model
- Fields: id (UUID PK), organization_id (via TenantMixin), user_id (FK to users), title (str), message (text), notification_type (enum: info, warning, success, error), is_read (bool, default False), read_at (datetime, nullable)
- Enum: `NotificationType` (StrEnum)
- Register model in `app/models/__init__.py`

**Commit:** `feat: add Notification model`

### Task 2: Notification Schemas
Create `backend/app/schemas/notifications.py` with:
- `NotificationCreate` — title, message, notification_type, user_id
- `NotificationResponse` — all fields with `from_attributes`
- `NotificationListResponse` — items list + total count
- `NotificationUpdate` — is_read (optional)

**Commit:** `feat: add notification Pydantic schemas`

### Task 3: Notification Service
Create `backend/app/services/notifications.py` with `NotificationService`:
- `create(org_id, user_id, title, message, notification_type)` — create notification
- `list_for_user(user_id, org_id, unread_only, skip, limit)` — paginated list
- `mark_as_read(notification_id, user_id)` — mark single notification read
- `mark_all_as_read(user_id, org_id)` — mark all notifications read for user
- `get_unread_count(user_id, org_id)` — count of unread notifications
- `delete(notification_id, user_id)` — delete a notification

**Commit:** `feat: add NotificationService`

### Task 4: Notification Router
Create `backend/app/routers/notifications.py` with:
- `GET /api/notifications` — list notifications (with ?unread_only query param)
- `POST /api/notifications` — create notification (admin only)
- `GET /api/notifications/unread-count` — get unread count
- `PATCH /api/notifications/{id}/read` — mark as read
- `POST /api/notifications/mark-all-read` — mark all as read
- `DELETE /api/notifications/{id}` — delete notification
- Register router in `app/main.py`

**Commit:** `feat: add notification API routes`

### Task 5: Alembic Migration
Generate migration for the notifications table.

**Commit:** `feat: add notifications migration`

### Task 6: Tests
- Model tests: `tests/test_models/test_notification.py`
- Service tests: `tests/test_services/test_notifications.py`
- Router tests: `tests/test_routers/test_notifications.py`

**Commit:** `test: add notification tests`
