import {
  CheckCircle2,
  Code2,
  FileJson2,
  Focus,
  Network,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Undo2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { routes } from "../../app/router/routes";
import { BackButton } from "../../components/navigation/BackButton";
import { Breadcrumbs } from "../../components/navigation/Breadcrumbs";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DropdownMenu } from "../../components/ui/DropdownMenu";
import { IconButton } from "../../components/ui/IconButton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { QueryExecutionState } from "../query-execution/QueryExecutionPanel";
import { returnState } from "../../shared/navigation/navigationState";
import type { BuilderState } from "./state";

interface QueryBuilderHeaderProps {
  bottomCollapsed: boolean;
  busy: string | null;
  canCompile: boolean;
  canExecute: boolean;
  canValidate: boolean;
  connection: string;
  execution: QueryExecutionState;
  focusMode: boolean;
  leftCollapsed: boolean;
  name: string;
  onAddRelationship: () => void;
  onCancel: () => void;
  onCompile: () => void;
  onExecute: () => void;
  onRedo: () => void;
  onResetDocument: () => void;
  onResetLayout: () => void;
  onSave: (validate: boolean) => void;
  onToggleBottom: () => void;
  onToggleFocus: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onUndo: () => void;
  onValidate: () => void;
  rightCollapsed: boolean;
  saveError: boolean;
  state: BuilderState;
}

export function QueryBuilderHeader(props: QueryBuilderHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const executing =
    props.execution.status === "executing" || props.execution.status === "cancelling";
  return (
    <header className="query-builder-toolbar">
      <div className="flex min-w-0 items-center gap-2">
        <BackButton fallback={routes.queries.list()} label="Volver" />
        <div className="hidden min-w-0 xl:block">
          <Breadcrumbs
            items={[
              { label: "Consultas", to: routes.queries.list() },
              { label: props.name },
              { label: "Constructor" },
            ]}
          />
        </div>
        <div className="min-w-0 border-l border-border pl-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-bold sm:max-w-56 xl:max-w-80">{props.name}</h1>
            <Badge variant={props.saveError ? "danger" : props.state.dirty ? "warning" : "success"}>
              {props.busy === "save"
                ? "Guardando…"
                : props.saveError
                  ? "Error al guardar"
                  : props.state.dirty
                    ? "Cambios sin guardar"
                    : "Guardado"}
            </Badge>
            {props.state.readOnly ? <StatusBadge>Solo lectura</StatusBadge> : null}
          </div>
          <p className="hidden truncate text-[11px] text-muted lg:block">
            {props.connection} · Revisión {props.state.revision}
          </p>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-0.5 border-r border-border pr-1 lg:flex">
          <IconButton
            disabled={props.state.readOnly || !props.state.history.length}
            label="Deshacer"
            onClick={props.onUndo}
            size="sm"
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 className="size-4" />
          </IconButton>
          <IconButton
            disabled={props.state.readOnly || !props.state.future.length}
            label="Rehacer"
            onClick={props.onRedo}
            size="sm"
            title="Rehacer (Ctrl+Shift+Z)"
          >
            <Redo2 className="size-4" />
          </IconButton>
        </div>
        <div className="hidden items-center gap-0.5 border-r border-border pr-1 xl:flex">
          <IconButton
            label={props.leftCollapsed ? "Mostrar catálogo" : "Ocultar catálogo"}
            onClick={props.onToggleLeft}
            size="sm"
          >
            <PanelLeft className="size-4" />
          </IconButton>
          <IconButton
            label={props.rightCollapsed ? "Mostrar inspector" : "Ocultar inspector"}
            onClick={props.onToggleRight}
            size="sm"
          >
            <PanelRight className="size-4" />
          </IconButton>
          <IconButton
            label={props.bottomCollapsed ? "Expandir panel inferior" : "Minimizar panel inferior"}
            onClick={props.onToggleBottom}
            size="sm"
          >
            <PanelBottom className="size-4" />
          </IconButton>
          <IconButton
            label={props.focusMode ? "Salir del modo enfoque" : "Activar modo enfoque"}
            onClick={props.onToggleFocus}
            size="sm"
          >
            <Focus className="size-4" />
          </IconButton>
        </div>
        <Button
          className="hidden sm:inline-flex"
          disabled={props.state.readOnly || !props.state.dirty || Boolean(props.busy)}
          onClick={() => {
            props.onSave(false);
          }}
          size="sm"
          startIcon={<Save className="size-4" />}
          variant="secondary"
        >
          Guardar
        </Button>
        <Button
          className="hidden md:inline-flex"
          disabled={!props.canValidate || Boolean(props.busy)}
          loading={props.busy === "validate"}
          onClick={props.onValidate}
          size="sm"
          startIcon={<CheckCircle2 className="size-4" />}
          variant="secondary"
        >
          Validar
        </Button>
        {executing ? (
          <Button
            onClick={props.onCancel}
            size="sm"
            startIcon={<Square className="size-4" />}
            variant="secondary"
          >
            {props.execution.status === "cancelling" ? "Cancelando…" : "Cancelar"}
          </Button>
        ) : (
          <Button
            disabled={!props.canExecute || !props.execution.canRun}
            onClick={props.onExecute}
            size="sm"
            startIcon={<Play className="size-4" />}
          >
            {props.execution.hasResult ? "Reejecutar" : "Ejecutar"}
          </Button>
        )}
        <DropdownMenu
          items={[
            {
              disabled: !props.canCompile || Boolean(props.busy),
              icon: <Code2 className="size-4" />,
              label: "Compilar SQL",
              onSelect: props.onCompile,
            },
            {
              icon: <FileJson2 className="size-4" />,
              label: "Abrir JSON técnico",
              onSelect: () => {
                void navigate(routes.queries.editJson(props.state.queryId), {
                  state: returnState(location),
                });
              },
            },
            {
              disabled: props.state.readOnly,
              icon: <Network className="size-4" />,
              label: "Añadir relación",
              onSelect: props.onAddRelationship,
            },
            {
              disabled: props.state.readOnly || !props.state.dirty,
              icon: <RotateCcw className="size-4" />,
              label: "Descartar cambios",
              onSelect: props.onResetDocument,
            },
            {
              icon: <PanelBottom className="size-4" />,
              label: "Restablecer diseño",
              onSelect: props.onResetLayout,
            },
          ]}
          label="Más acciones del constructor"
        />
      </div>
    </header>
  );
}
