from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ColumnFormat(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal[
        "automatic",
        "text",
        "integer",
        "decimal",
        "currency",
        "percentage",
        "boolean",
        "date",
        "datetime",
        "time",
        "json",
    ] = "automatic"
    decimal_places: int | None = Field(default=None, ge=0, le=12)
    currency_code: str | None = Field(default=None, min_length=3, max_length=3)
    date_format: str | None = Field(default=None, max_length=64)
    datetime_format: str | None = Field(default=None, max_length=64)
    true_label: str = Field(default="Sí", max_length=64)
    false_label: str = Field(default="No", max_length=64)
    null_label: str = Field(default="NULL", max_length=64)
    truncate_length: int | None = Field(default=None, ge=1, le=10000)


class ReportColumn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_key: str = Field(min_length=1, max_length=255)
    label: str = Field(min_length=1, max_length=255)
    visible: bool = True
    position: int = Field(ge=0)
    width: int | None = Field(default=None, ge=40, le=1000)
    alignment: Literal["left", "center", "right"] = "left"
    format: ColumnFormat = Field(default_factory=ColumnFormat)


class ReportLayout(BaseModel):
    model_config = ConfigDict(extra="forbid")
    orientation: Literal["portrait", "landscape"] = "portrait"
    page_size: Literal["A4", "letter"] = "A4"
    show_generated_at: bool = True
    show_page_numbers: bool = True


class ReportHeader(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    subtitle: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class ReportFooter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(default="", max_length=500)
    show_row_count: bool = True


class ReportConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Literal[1] = 1
    layout: ReportLayout = Field(default_factory=ReportLayout)
    header: ReportHeader
    columns: list[ReportColumn] = Field(min_length=1, max_length=500)
    footer: ReportFooter = Field(default_factory=ReportFooter)
    locale: str = Field(default="es-EC", min_length=2, max_length=32)
    timezone: str = Field(default="America/Guayaquil", min_length=1, max_length=64)
    parameters: dict[str, dict[str, Any]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def valid_columns(self) -> "ReportConfiguration":
        keys = [item.source_key for item in self.columns]
        positions = [item.position for item in self.columns]
        if len(keys) != len(set(keys)) or len(positions) != len(set(positions)):
            raise ValueError("Las columnas y posiciones deben ser únicas.")
        if not any(item.visible for item in self.columns):
            raise ValueError("El reporte requiere al menos una columna visible.")
        return self
