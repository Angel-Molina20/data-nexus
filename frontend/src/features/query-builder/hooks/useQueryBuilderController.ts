import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../../auth/context";
import { getConnection } from "../../connections/api/connectionsApi";
import type { QueryDocument, SavedQuery } from "../../queries/types";
import {
  compileUniversalQuery,
  duplicateQuery,
  updateQuery,
  validateQueryModel,
} from "../../queries/api/queriesApi";
import { getSchemaEntity } from "../../schema/api/schemaApi";
import type { SchemaEntity } from "../../schema/types";
import { ApiError } from "../../../shared/api/httpClient";
import { builderReducer, createBuilderState, localIssues, queryActions } from "../state";
import { useBuilderKeyboardShortcuts } from "./useBuilderShortcuts";
import { useUnsavedChangesGuard } from "../../../shared/hooks/useUnsavedChangesGuard";
import { useReturnNavigation } from "../../../shared/hooks/useReturnNavigation";
import { routes } from "../../../app/router/routes";

export function useQueryBuilderController(savedQuery: SavedQuery) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isReadOnly = !auth.hasPermission("queries.update");
  const [state, dispatch] = useReducer(builderReducer, createBuilderState(savedQuery, isReadOnly));
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isRelationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [isCatalogOpen, setCatalogOpen] = useState(true);
  const [isInspectorOpen, setInspectorOpen] = useState(true);
  const connection = useQuery({
    queryKey: ["connection", savedQuery.connection_id],
    queryFn: () => getConnection(savedQuery.connection_id),
  });
  const sourceIds = useMemo(
    () => [
      state.workingQuery.query.source.entity_id,
      ...state.workingQuery.query.joins.map((join) => join.source.entity_id),
    ],
    [state.workingQuery],
  );
  const entityQueries = useQueries({
    queries: sourceIds.map((entityId) => ({
      queryKey: ["builder-entity", savedQuery.connection_id, entityId],
      queryFn: () => getSchemaEntity(savedQuery.connection_id, entityId),
    })),
  });
  const entities = useMemo(
    () =>
      Object.fromEntries(
        entityQueries.flatMap((query) =>
          query.data ? [[query.data.id, query.data] as [string, SchemaEntity]] : [],
        ),
      ),
    [entityQueries],
  );
  const problems = useMemo(() => localIssues(state.workingQuery), [state.workingQuery]);

  const unsaved = useUnsavedChangesGuard(state.dirty);
  const { returnTo } = useReturnNavigation(routes.queries.list());
  useBuilderKeyboardShortcuts(dispatch);

  const save = useMutation({
    mutationFn: (document: QueryDocument) =>
      updateQuery(savedQuery.id, { revision: state.revision, document }),
    onSuccess: (saved) => {
      dispatch({ type: "saved", saved });
      queryClient.setQueryData(["query", savedQuery.id], saved);
      void queryClient.invalidateQueries({ queryKey: ["queries"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "QUERY_REVISION_CONFLICT")
        dispatch({ type: "conflict", value: true });
    },
    onSettled: () => {
      setBusyAction(null);
    },
  });

  const validate = async () => {
    if (problems.length) {
      dispatch({ type: "bottom_tab", tab: "problems" });
      return;
    }
    setBusyAction("validate");
    try {
      dispatch({ type: "validation", value: await validateQueryModel(state.workingQuery) });
    } finally {
      setBusyAction(null);
    }
  };
  const compile = async () => {
    setBusyAction("compile");
    try {
      dispatch({ type: "compilation", value: await compileUniversalQuery(state.workingQuery) });
    } finally {
      setBusyAction(null);
    }
  };
  const modify = (document: QueryDocument) => {
    dispatch({ type: "replace", document });
  };
  const updateLayout = (sourceId: string, x: number, y: number) => {
    modify(
      queryActions.update(state.workingQuery, (draft) => {
        const layout = draft.metadata.builder_layout ?? {
          nodes: {},
          panels: { catalog_width: 280, inspector_width: 360 },
        };
        layout.nodes[sourceId] = { x, y, collapsed: layout.nodes[sourceId]?.collapsed ?? false };
        draft.metadata.builder_layout = layout;
      }),
    );
  };
  const leave = (path = returnTo) => void navigate(path);
  const duplicate = () => {
    void duplicateQuery(savedQuery.id).then((copy) => navigate(`/queries/${copy.id}/builder`));
  };
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["query", savedQuery.id] });
    dispatch({ type: "conflict", value: false });
  };
  const saveDocument = (andValidate: boolean) => {
    setBusyAction("save");
    save.mutate(state.workingQuery, {
      onSuccess: () => {
        if (andValidate) void validate();
      },
    });
  };

  return {
    auth,
    busyAction,
    compile,
    connection,
    dispatch,
    duplicate,
    entities,
    isCatalogOpen,
    isInspectorOpen,
    isReadOnly,
    isRelationshipDialogOpen,
    leave,
    modify,
    problems,
    reload,
    returnTo,
    save,
    savedQuery,
    setCatalogOpen,
    saveDocument,
    setInspectorOpen,
    setRelationshipDialogOpen,
    state,
    unsaved,
    updateLayout,
    validate,
  };
}
