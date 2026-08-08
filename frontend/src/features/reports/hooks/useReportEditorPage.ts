import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { listQueries } from "../../queries/api/queriesApi";
import { createReport, getReport, updateReport } from "../api/reportsApi";
import {
  automaticReportFormat,
  emptyReportDraft,
  type ParameterSettings,
  type ReportDraft,
} from "../model/reportEditor";
import type { ReportColumn, ReportConfiguration } from "../types";
import { useReturnNavigation } from "../../../shared/hooks/useReturnNavigation";
import { useUnsavedChangesGuard } from "../../../shared/hooks/useUnsavedChangesGuard";
import { routes } from "../../../app/router/routes";

export function useReportEditorPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(reportId);
  const fallback = isEditing ? routes.reports.detail(reportId ?? "") : routes.reports.list();
  const { returnTo } = useReturnNavigation(fallback);
  const queries = useQuery({ queryKey: ["queries"], queryFn: () => listQueries() });
  const report = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId ?? ""),
    enabled: isEditing,
  });
  const [draft, setDraft] = useState<ReportDraft>(emptyReportDraft);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyReportDraft));
  const selectedQuery = useMemo(
    () => queries.data?.items.find((query) => query.id === draft.queryId),
    [draft.queryId, queries.data],
  );

  useEffect(() => {
    if (!selectedQuery || (isEditing && report.data)) return;
    setDraft((current) => ({
      ...current,
      columns: selectedQuery.document.query.select.map((field, position) => ({
        source_key: field.alias ?? field.label ?? field.select_id,
        label: field.label ?? field.alias ?? field.select_id,
        visible: !field.hidden,
        position,
        alignment: "left",
        format: automaticReportFormat(),
      })),
      parameterSettings: Object.fromEntries(
        selectedQuery.document.parameters.map((parameter) => [
          parameter.parameter_id,
          {
            label: parameter.label,
            description: parameter.description ?? "",
            visible: true,
            ...(parameter.default_value !== undefined
              ? { default_value: parameter.default_value }
              : {}),
          },
        ]),
      ),
    }));
  }, [isEditing, report.data, selectedQuery]);

  useEffect(() => {
    if (!report.data) return;
    const loadedDraft: ReportDraft = {
      columns: report.data.configuration.columns,
      description: report.data.description ?? "",
      footer: report.data.configuration.footer.text,
      name: report.data.name,
      orientation: report.data.configuration.layout.orientation,
      pageSize: report.data.configuration.layout.page_size,
      parameterSettings: report.data.configuration.parameters as ParameterSettings,
      queryId: report.data.query_id,
      subtitle: report.data.configuration.header.subtitle ?? "",
      title: report.data.configuration.header.title,
    };
    setDraft(loadedDraft);
    setBaseline(JSON.stringify(loadedDraft));
  }, [report.data]);

  const isDirty = JSON.stringify(draft) !== baseline;
  const unsaved = useUnsavedChangesGuard(isDirty);

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedQuery) throw new Error("Selecciona una consulta");
      const configuration: ReportConfiguration = {
        version: 1,
        layout: {
          orientation: draft.orientation,
          page_size: draft.pageSize,
          show_generated_at: true,
          show_page_numbers: true,
        },
        header: {
          title: draft.title,
          subtitle: draft.subtitle || null,
          description: draft.description || null,
        },
        columns: draft.columns,
        footer: { text: draft.footer, show_row_count: true },
        locale: "es-EC",
        timezone: "America/Guayaquil",
        parameters: draft.parameterSettings,
      };
      const payload = { name: draft.name, description: draft.description || null, configuration };
      return isEditing
        ? updateReport(reportId ?? "", payload)
        : createReport({
            ...payload,
            query_id: selectedQuery.id,
            query_revision: selectedQuery.revision,
          });
    },
    onSuccess: (savedReport) => {
      setBaseline(JSON.stringify(draft));
      unsaved.navigateWithoutPrompt(() => {
        const detailPath = routes.reports.detail(savedReport.id);
        void navigate(detailPath, {
          state: returnTo !== detailPath ? { from: returnTo } : undefined,
        });
      });
    },
  });

  const updateDraft = (patch: Partial<ReportDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const updateParameter = (parameterId: string, patch: Partial<ParameterSettings[string]>) => {
    setDraft((current) => ({
      ...current,
      parameterSettings: {
        ...current.parameterSettings,
        [parameterId]: {
          ...current.parameterSettings[parameterId],
          label: current.parameterSettings[parameterId]?.label ?? "",
          description: current.parameterSettings[parameterId]?.description ?? "",
          visible: current.parameterSettings[parameterId]?.visible ?? true,
          ...patch,
        },
      },
    }));
  };
  const setColumns = (columns: ReportColumn[]) => {
    updateDraft({ columns });
  };
  const isValid = Boolean(
    draft.name.trim() &&
      draft.title.trim() &&
      selectedQuery &&
      draft.columns.some((column) => column.visible),
  );

  return {
    draft,
    isEditing,
    isDirty,
    isValid,
    queries,
    report,
    save,
    selectedQuery,
    setColumns,
    updateDraft,
    updateParameter,
    returnTo,
    unsaved,
  };
}
