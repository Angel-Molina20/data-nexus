# DataNexus backend

API FastAPI con health checks y gestión segura de conexiones MySQL. Las
credenciales se cifran mediante la clave Fernet de
`CREDENTIAL_ENCRYPTION_KEY`; las rutas públicas usan UUID y nunca devuelven
secretos. La ejecución recomendada se realiza con Docker Compose.
