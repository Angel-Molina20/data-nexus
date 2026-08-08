import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El correo es obligatorio.")
    .pipe(z.email("Ingresa un correo válido.")),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export type LoginFormData = z.infer<typeof loginSchema>;
