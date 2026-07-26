import {
  CalendarClock,
  FileBarChart,
  SearchCode,
  Settings,
  Users,
} from "lucide-react";
import { createBrowserRouter } from "react-router";

import { App } from "../App";
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

export const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
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
      {
        path: "queries",
        element: (
          <ModulePage
            title="Consultas"
            description="Construye y administra consultas visuales parametrizadas."
            detail="El constructor visual se incorporará cuando estén listos el catálogo y el modelo universal."
            icon={SearchCode}
            phase="Fase 8"
          />
        ),
      },
      {
        path: "reports",
        element: (
          <ModulePage
            title="Reportes"
            description="Organiza reportes reutilizables sobre múltiples fuentes de datos."
            detail="Los reportes funcionales se habilitarán en una fase posterior."
            icon={FileBarChart}
            phase="Fase 9"
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
      {
        path: "users",
        element: (
          <ModulePage
            title="Usuarios"
            description="Gestiona el acceso de los equipos a DataNexus."
            detail="La autenticación, los usuarios y los permisos se incorporarán más adelante."
            icon={Users}
            phase="Próximamente"
          />
        ),
      },
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
