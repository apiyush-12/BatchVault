import { z } from "zod";

/**
 * Validation schemas for the batches domain (rules.md §1.6).
 *
 * Limits mirror database.md §3.2's CHECK constraints exactly (security.md
 * §13), so a bad request fails early with a clear message rather than a raw
 * constraint violation later.
 */

const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a batch name.")
  .max(120, "Batch name must be 120 characters or fewer.");

const institutionNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your institution's name.")
  .max(200, "Institution name must be 200 characters or fewer.");

const optionalShortText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional();

// Kept as a plain string in the form-facing schema — a `<input type="number">`
// registers as a string, and a `.transform()` here would make the resolver's
// input type differ from its output type, which breaks react-hook-form's
// type inference against `z.infer<...>`. Numeric conversion happens once,
// in `actions.ts`, right before the RPC call.
const graduationYearFieldSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4}$/.test(value),
    "Enter a 4-digit year.",
  )
  .refine((value) => {
    if (value === "") return true;
    const year = Number(value);
    return year >= 1900 && year <= 2200;
  }, "Enter a realistic graduation year.")
  .optional();

export const joinPolicySchema = z.enum([
  "invite_only_auto_approve",
  "invite_only_requires_approval",
]);

// Allowlist, never denylist (rules.md §1.6): unknown fields are rejected
// outright. `visibility` is absent on purpose — batch_visibility has exactly
// one legal value today, so there is nothing for the client to choose.
export const createBatchInputSchema = z
  .object({
    name: nameSchema,
    institutionName: institutionNameSchema,
    courseName: optionalShortText(200, "Course name"),
    departmentName: optionalShortText(200, "Department name"),
    graduationYear: graduationYearFieldSchema,
    section: optionalShortText(40, "Section"),
    description: optionalShortText(2000, "Description"),
    // No `.default()` here: a defaulted field's inferred type has an
    // optional INPUT but a required OUTPUT, which breaks react-hook-form's
    // resolver typing against `z.infer<...>`. The default lives in the
    // form's `useForm({ defaultValues })` instead, and the <select> always
    // has a real selected option.
    joinPolicy: joinPolicySchema,
  })
  .strict();

export const updateBatchSettingsInputSchema = z
  .object({
    batchId: z.string().uuid(),
    name: nameSchema,
    institutionName: institutionNameSchema,
    courseName: optionalShortText(200, "Course name"),
    departmentName: optionalShortText(200, "Department name"),
    graduationYear: graduationYearFieldSchema,
    section: optionalShortText(40, "Section"),
    description: optionalShortText(2000, "Description"),
    joinPolicy: joinPolicySchema,
  })
  .strict();

export type CreateBatchInput = z.infer<typeof createBatchInputSchema>;
export type UpdateBatchSettingsInput = z.infer<typeof updateBatchSettingsInputSchema>;
