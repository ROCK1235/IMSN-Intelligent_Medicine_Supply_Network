import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createCategorySchema = z.object({
  name: z.string().trim().min(3, "Category name must be at least 3 characters").max(50),
  description: z.string().trim().max(500).optional(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9\-]+$/, "Code must be letters, numbers, and hyphens"),
  parentCategory: z.string().regex(objectIdRegex, "Invalid parent category id").optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(3).max(50).optional(),
    description: z.string().trim().max(500).optional(),
    parentCategory: z
      .string()
      .regex(objectIdRegex, "Invalid parent category id")
      .nullable()
      .optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.enum(["true", "false"]).optional(),
  rootOnly: z.enum(["true", "false"]).optional(),
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
