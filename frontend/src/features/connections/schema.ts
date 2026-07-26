import { z } from "zod";

export const connectionSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre."),
  engine: z.literal("mysql"),
  host: z.string().trim().min(1, "Ingresa un host."),
  port: z.number().int().min(1).max(65535),
  database_name: z.string().trim().min(1, "Ingresa la base de datos."),
  username: z.string().trim().min(1, "Ingresa el usuario."),
  password: z.string().min(1, "Ingresa la contraseña."),
  ssl_enabled: z.boolean(),
  configuration: z.record(z.string(), z.unknown()),
});

export const editConnectionSchema = connectionSchema.extend({
  password: z.string(),
});
