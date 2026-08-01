import {
  CalendarClock,
  FileBarChart,
  Settings,
} from "lucide-react";
import { createBrowserRouter } from "react-router";

import { ConnectionsPage } from "../pages/ConnectionsPage";
import { ConnectionDetailPage } from "../pages/ConnectionDetailPage";
import { EditConnectionPage } from "../pages/EditConnectionPage";
import { HomePage } from "../pages/HomePage";
import { ModulePage } from "../pages/ModulePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { NewConnectionPage } from "../pages/NewConnectionPage";
import { ManualRelationshipPage } from "../pages/ManualRelationshipPage";
import { PolymorphicRelationshipPage } from "../pages/PolymorphicRelationshipPage";
import { RelationshipCandidatesPage } from "../pages/RelationshipCandidatesPage";
import { RelationshipsPage } from "../pages/RelationshipsPage";
import { SchemaExplorerPage } from "../pages/SchemaExplorerPage";
import { SchemaIndexPage } from "../pages/SchemaIndexPage";
import { SchemaSynchronizationsPage } from "../pages/SchemaSynchronizationsPage";
import { SemanticCatalogIndexPage } from "../pages/SemanticCatalogIndexPage";
import { SemanticCatalogPage } from "../pages/SemanticCatalogPage";
import { ProtectedRoute, PermissionGuard } from "../features/auth/guards";
import { ChangePasswordPage } from "../pages/ChangePasswordPage";
import { LoginPage } from "../pages/LoginPage";
import { RolesPage } from "../pages/RolesPage";
import { UsersPage } from "../pages/UsersPage";
import { NewQueryPage } from "../pages/NewQueryPage";
import { QueriesPage } from "../pages/QueriesPage";
import { QueryDetailPage } from "../pages/QueryDetailPage";
import { QueryJsonEditorPage } from "../pages/QueryJsonEditorPage";
import { QueryCompilePage } from "../pages/QueryCompilePage";
import { QueryBuilderPage } from "../pages/QueryBuilderPage";

export const router = createBrowserRouter([
  { path: "/login", Component: LoginPage },
  {
    path: "/",
    Component: ProtectedRoute,
    children: [
      { index: true, Component: HomePage },
      { path: "connections", Component: ConnectionsPage },
      { path: "connections/new", Component: NewConnectionPage },
      { path: "connections/:id", Component: ConnectionDetailPage },
      { path: "connections/:id/edit", Component: EditConnectionPage },
      { path: "schema", Component: SchemaIndexPage },
      { path: "connections/:id/schema", Component: SchemaExplorerPage },
      { path: "connections/:id/schema/entities/:entityId", Component: SchemaExplorerPage },
      { path: "connections/:id/schema/synchronizations", Component: SchemaSynchronizationsPage },
      { path: "connections/:id/relationships", Component: RelationshipsPage },
      { path: "connections/:id/relationships/candidates", Component: RelationshipCandidatesPage },
      { path: "connections/:id/relationships/new", Component: ManualRelationshipPage },
      { path: "connections/:id/relationships/polymorphic/new", Component: PolymorphicRelationshipPage },
      { path: "connections/:id/semantic-catalog", Component: SemanticCatalogPage },
      { path: "queries", element: <PermissionGuard permission="queries.read"><QueriesPage /></PermissionGuard> },
      { path: "queries/new", element: <PermissionGuard permission="queries.create"><NewQueryPage /></PermissionGuard> },
      { path: "queries/:id", element: <PermissionGuard permission="queries.read"><QueryDetailPage /></PermissionGuard> },
      { path: "queries/:id/builder", element: <PermissionGuard permission="queries.read"><QueryBuilderPage /></PermissionGuard> },
      { path: "queries/:id/edit-json", element: <PermissionGuard permission="queries.update"><QueryJsonEditorPage /></PermissionGuard> },
      { path: "queries/:id/compile", element: <PermissionGuard permission="queries.compile"><QueryCompilePage /></PermissionGuard> },
      {
        path: "reports",
        element: (
          <ModulePage
            title="Reportes"
            description="Organiza reportes reutilizables sobre múltiples fuentes de datos."
            detail="Los reportes funcionales se habilitarán en una fase posterior."
            icon={FileBarChart}
            phase="Fase 10"
          />
        ),
      },
      { path: "semantic-catalog", Component: SemanticCatalogIndexPage },
      {
        path: "schedules",
        element: (
          <ModulePage
            title="Programaciones"
            description="Planifica ejecuciones periódicas de consultas y reportes."
            detail="Las tareas programadas no forman parte del alcance actual."
            icon={CalendarClock}
            phase="Próximamente"
          />
        ),
      },
      { path: "users", element: <PermissionGuard permission="users.read"><UsersPage /></PermissionGuard> },
      { path: "settings/roles", element: <PermissionGuard permission="roles.read"><RolesPage /></PermissionGuard> },
      { path: "account/change-password", Component: ChangePasswordPage },
      {
        path: "settings",
        element: (
          <ModulePage
            title="Configuración"
            description="Configura las preferencias generales de la plataforma."
            detail="Las opciones de configuración se añadirán conforme se habiliten nuevos módulos."
            icon={Settings}
            phase="Próximamente"
          />
        ),
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
