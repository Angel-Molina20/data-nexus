import type { ReportColumn } from "../types";

export type ReportOrientation = "portrait" | "landscape";
export type ReportPageSize = "A4" | "letter";
export type ParameterSettings = Record<
  string,
  {
    label: string;
    description: string;
    visible: boolean;
    default_value?: unknown;
  }
>;

export interface ReportDraft {
  columns: ReportColumn[];
  description: string;
  footer: string;
  name: string;
  orientation: ReportOrientation;
  pageSize: ReportPageSize;
  parameterSettings: ParameterSettings;
  queryId: string;
  subtitle: string;
  title: string;
}

export const emptyReportDraft: ReportDraft = {
  columns: [],
  description: "",
  footer: "",
  name: "",
  orientation: "portrait",
  pageSize: "A4",
  parameterSettings: {},
  queryId: "",
  subtitle: "",
  title: "",
};

export const automaticReportFormat = () => ({
  type: "automatic",
  null_label: "NULL",
  true_label: "Sí",
  false_label: "No",
});
