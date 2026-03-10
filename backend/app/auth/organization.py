from sqlalchemy import Select

from app.models.user import User


def org_filter[T](query: Select[T], user: User) -> Select[T]:
    """Add organization_id filter to a SQLAlchemy query for data isolation.

    Superadmins bypass the filter and see all data.
    """
    if user.is_superadmin:
        return query

    # Get the primary entity from the query's column descriptions
    entity = query.column_descriptions[0]["entity"]

    return query.where(entity.organization_id == user.organization_id)
