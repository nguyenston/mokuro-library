import { z } from 'zod';
import type { PatchOperation } from '../types/history';

const indexSegment = String.raw`\d+`;

const blockElementPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}$`
);
const lineElementPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}/lines/${indexSegment}$`
);
const blockReorderPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks$`
);
const lineReorderPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}/lines$`
);
const textPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}/lines/${indexSegment}/text$`
);
const coordsPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}/lines/${indexSegment}/coords$`
);
const boxPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}/box$`
);
const verticalPath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}/vertical$`
);
const fontSizePath = new RegExp(
  String.raw`^/pages/${indexSegment}/blocks/${indexSegment}/font_size$`
);

const coordinateSchema = z.tuple([z.number(), z.number()]);
const rectSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number()
]);
const quadSchema = z.tuple([
  coordinateSchema,
  coordinateSchema,
  coordinateSchema,
  coordinateSchema
]);
const unifiedLineSchema = z.object({
  text: z.string(),
  coords: quadSchema
}).strict();
const unifiedBlockSchema = z.object({
  box: rectSchema,
  vertical: z.boolean(),
  font_size: z.number().optional(),
  lines: z.array(unifiedLineSchema)
}).strict();

const permutationSchema = z.array(z.number().int().nonnegative()).superRefine((order, ctx) => {
  const sorted = [...order].sort((left, right) => left - right);
  if (!sorted.every((oldIndex, newIndex) => oldIndex === newIndex)) {
    ctx.addIssue({
      code: 'custom',
      message: 'new_order must contain every index from 0 to n-1 exactly once'
    });
  }
});

const replaceSchema = z.object({
  op: z.literal('replace'),
  path: z.string(),
  value: z.unknown(),
  old_value: z.unknown()
}).strict().superRefine((operation, ctx) => {
  const valueSchema = schemaForReplacePath(operation.path);
  if (!valueSchema) {
    addInvalidPathIssue(ctx, 'replace', operation.path);
    return;
  }

  addValueIssues(valueSchema, operation.value, 'value', ctx);
  addValueIssues(valueSchema, operation.old_value, 'old_value', ctx);
});

const addSchema = z.object({
  op: z.literal('add'),
  path: z.string(),
  value: z.unknown()
}).strict().superRefine((operation, ctx) => {
  const valueSchema = schemaForElementPath(operation.path);
  if (!valueSchema) {
    addInvalidPathIssue(ctx, 'add', operation.path);
    return;
  }

  addValueIssues(valueSchema, operation.value, 'value', ctx);
});

const removeSchema = z.object({
  op: z.literal('remove'),
  path: z.string(),
  old_value: z.unknown()
}).strict().superRefine((operation, ctx) => {
  const valueSchema = schemaForElementPath(operation.path);
  if (!valueSchema) {
    addInvalidPathIssue(ctx, 'remove', operation.path);
    return;
  }

  addValueIssues(valueSchema, operation.old_value, 'old_value', ctx);
});

const reorderSchema = z.object({
  op: z.literal('reorder'),
  path: z.string(),
  new_order: permutationSchema
}).strict().superRefine((operation, ctx) => {
  if (!blockReorderPath.test(operation.path) && !lineReorderPath.test(operation.path)) {
    addInvalidPathIssue(ctx, 'reorder', operation.path);
  }
});

/** Runtime schema for the complete PatchOperation grammar in Appendix A. */
export const patchOperationSchema: z.ZodType<PatchOperation> = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('genesis'),
    path: z.string().min(1, 'Genesis path must not be empty')
  }).strict(),
  replaceSchema,
  addSchema,
  removeSchema,
  reorderSchema
]) as z.ZodType<PatchOperation>;

/** Validate an unknown value and return it as a PatchOperation. */
export function parsePatchOperation(value: unknown): PatchOperation {
  return patchOperationSchema.parse(value);
}

/** Parse and validate a PatchOperation serialized in a database row. */
export function parseStoredPatchOperation(
  serialized: string,
  context = 'stored patch operation'
): PatchOperation {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Invalid JSON in ${context}`, { cause: error });
  }

  const result = patchOperationSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid ${context}: ${z.prettifyError(result.error)}`, {
      cause: result.error
    });
  }

  return result.data;
}

/** Select the required value shape for a replace operation's leaf path. */
function schemaForReplacePath(path: string): z.ZodType | null {
  if (textPath.test(path)) return z.string();
  if (coordsPath.test(path)) return quadSchema;
  if (boxPath.test(path)) return rectSchema;
  if (verticalPath.test(path)) return z.boolean();
  if (fontSizePath.test(path)) return z.number();
  return null;
}

/** Select the required coarse value shape for an add or remove element path. */
function schemaForElementPath(path: string): z.ZodType | null {
  if (blockElementPath.test(path)) return unifiedBlockSchema;
  if (lineElementPath.test(path)) return unifiedLineSchema;
  return null;
}

/** Copy nested schema failures onto the operation's named value property. */
function addValueIssues(
  schema: z.ZodType,
  value: unknown,
  field: 'value' | 'old_value',
  ctx: z.RefinementCtx
): void {
  const result = schema.safeParse(value);
  if (result.success) return;

  for (const issue of result.error.issues) {
    ctx.addIssue({
      code: 'custom',
      message: issue.message,
      path: [field, ...issue.path]
    });
  }
}

/** Report an operation/path combination outside the documented patch grammar. */
function addInvalidPathIssue(
  ctx: z.RefinementCtx,
  operation: Exclude<PatchOperation['op'], 'genesis'>,
  path: string
): void {
  ctx.addIssue({
    code: 'custom',
    message: `Path ${path} is not valid for a ${operation} operation`,
    path: ['path']
  });
}
