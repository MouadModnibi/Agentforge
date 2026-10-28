import { z } from "zod";
export const FormConfig = z.object({
  title: z.string().trim().min(1).max(150),
  fields: z
    .array(
      z.object({
        name: z
          .string()
          .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
          .refine(
            (v) =>
              !["constructor", "prototype", "__proto__", "token"].includes(v),
          ),
        label: z.string().min(1).max(120),
        type: z.enum(["text", "email", "textarea"]).default("text"),
        required: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (fields) => new Set(fields.map((f) => f.name)).size === fields.length,
      "Duplicate field names",
    ),
});
