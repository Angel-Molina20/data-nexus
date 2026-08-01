from typing import Final

PERMISSIONS: Final[dict[str, tuple[str, str]]] = {
    "connections.read": ("Ver conexiones", "connections"),
    "connections.create": ("Crear conexiones", "connections"),
    "connections.update": ("Editar conexiones", "connections"),
    "connections.delete": ("Eliminar conexiones", "connections"),
    "connections.test": ("Probar conexiones", "connections"),
    "connections.manage_credentials": ("Gestionar credenciales", "connections"),
    "connections.manage_access": ("Gestionar acceso", "connections"),
    "schemas.read": ("Ver esquemas", "schemas"),
    "schemas.synchronize": ("Sincronizar esquemas", "schemas"),
    "relationships.read": ("Ver relaciones", "relationships"),
    "relationships.detect": ("Detectar relaciones", "relationships"),
    "relationships.create": ("Crear relaciones", "relationships"),
    "relationships.update": ("Editar relaciones", "relationships"),
    "relationships.delete": ("Eliminar relaciones", "relationships"),
    "relationships.confirm": ("Confirmar relaciones", "relationships"),
    "relationships.reject": ("Rechazar relaciones", "relationships"),
    "semantic_catalog.read": ("Ver catálogo semántico", "semantic_catalog"),
    "semantic_catalog.update": ("Editar catálogo semántico", "semantic_catalog"),
    "semantic_catalog.mark_sensitive": ("Marcar campos sensibles", "semantic_catalog"),
    "users.read": ("Ver usuarios", "users"),
    "users.create": ("Crear usuarios", "users"),
    "users.update": ("Editar usuarios", "users"),
    "users.disable": ("Desactivar usuarios", "users"),
    "users.unlock": ("Desbloquear usuarios", "users"),
    "users.reset_password": ("Restablecer contraseñas", "users"),
    "users.revoke_sessions": ("Revocar sesiones", "users"),
    "roles.read": ("Ver roles", "roles"),
    "roles.create": ("Crear roles", "roles"),
    "roles.update": ("Editar roles", "roles"),
    "roles.delete": ("Eliminar roles", "roles"),
    "roles.manage_permissions": ("Asignar permisos", "roles"),
    "audit.read": ("Ver auditoría", "audit"),
}

SYSTEM_ROLES: Final[dict[str, set[str]]] = {
    "administrator": set(PERMISSIONS),
    "analyst": {
        "connections.read",
        "connections.test",
        "schemas.read",
        "relationships.read",
        "semantic_catalog.read",
        "semantic_catalog.update",
    },
    "viewer": {
        "connections.read",
        "schemas.read",
        "relationships.read",
        "semantic_catalog.read",
    },
}

ACCESS_LEVELS: Final[dict[str, int]] = {"viewer": 1, "analyst": 2, "manager": 3}
