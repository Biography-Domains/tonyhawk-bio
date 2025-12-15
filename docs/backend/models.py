# models.py
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# --- Async-compatible Declarative Base (SQLAlchemy 2.x) ---
class Base(AsyncAttrs, DeclarativeBase):
    pass


# --- Mixins ---
class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class ToDictMixin:
    def to_dict(self) -> Dict[str, Any]:
        # Simple column-only dict (no relationships)
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


# --- Models ---
class Visitor(Base, UUIDPrimaryKeyMixin, TimestampMixin, ToDictMixin):
    __tablename__ = "visitors"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # relationships
    messages: Mapped[list["Message"]] = relationship(
        back_populates="visitor",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Achievement(Base, UUIDPrimaryKeyMixin, TimestampMixin, ToDictMixin):
    __tablename__ = "achievements"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class GalleryItem(Base, UUIDPrimaryKeyMixin, TimestampMixin, ToDictMixin):
    __tablename__ = "gallery"

    image_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    caption: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class Message(Base, UUIDPrimaryKeyMixin, TimestampMixin, ToDictMixin):
    __tablename__ = "messages"

    visitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visitors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Keep your explicit field too (in addition to mixin timestamps)
    # If you prefer to use only mixin's created_at, remove this field and update your app accordingly.
    created_at: Mapped[datetime] = mapped_column(  # type: ignore[assignment]
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # relationships
    visitor: Mapped["Visitor"] = relationship(back_populates="messages")