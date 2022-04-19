import { Result } from "esresult";
import { z, ZodTypeAny } from "zod";
import { Typed } from "../graph";

/**
 * @deprecated Use toZodSchema instead if possible.
 */
export function toTypeSchema(
  typed: Typed
): Result<
  ZodTypeAny,
  | Result.Err<"PROPS">
  | Result.Err<"SCHEMA">
  | Result.Err<"UNSUPPORTED", { type: string }>
> {
  const type = typed.$type;
  const typeDefinition = typeDefinitions[type];
  if (!typeDefinition) return Result.err("UNSUPPORTED").$info({ type });

  const $props = typeDefinition.schema.safeParse(typed);
  if (!$props.success) return Result.err("PROPS").$cause($props.error);

  const props = $props.data;
  const $schema = typeDefinition.build(props);
  if ("ok" in $schema) {
    if ($schema.ok) return Result.ok($schema.value);
    return Result.err("SCHEMA").$cause($schema);
  }

  const schema = $schema;
  return Result.ok(schema);
}

/////////////////////////////

interface Type<SCHEMA extends ZodTypeAny = ZodTypeAny> {
  schema: SCHEMA;
  build(props: z.infer<SCHEMA>): ZodTypeAny | Result<ZodTypeAny>;
}

function type<SCHEMA extends ZodTypeAny>(
  schema: Type<SCHEMA>["schema"],
  build: Type<SCHEMA>["build"]
): Type<SCHEMA> {
  return {
    schema,
    build,
  };
}

/////////////////////////////

const objectOf = z.record(
  Typed.extend({ required: z.boolean().optional() }).passthrough()
);

function fromObjectOf(
  _of: z.infer<typeof objectOf>
): Result<z.AnyZodObject, "KEY_VALUE" | "KEY_LOOKUP"> {
  let schema = z.object({});
  for (const key in _of) {
    const value = _of[key];
    if (!value) {
      return Result.err("KEY_LOOKUP").$info({ key });
    }
    const $valueSchema = toTypeSchema(value);
    if (!$valueSchema.ok)
      return Result.err("KEY_VALUE").$cause($valueSchema).$info({ key });
    let valueSchema = $valueSchema.value;
    const { required = true } = value;
    if (!required) valueSchema = valueSchema.optional();
    schema = schema.extend({ [key]: valueSchema });
  }
  return Result.ok(schema);
}

export const typeDefinitions: Record<string, Type> = {
  string: type(Typed, () => z.string()),
  number: type(Typed, () => z.number()),
  boolean: type(Typed, () => z.boolean()),
  array: type(
    Typed.extend({
      of: Typed.passthrough(),
    }),
    ({ of: _of }) => {
      const $ofSchema = toTypeSchema(_of);
      if (!$ofSchema.ok) return Result.err("OF").$cause($ofSchema);
      const ofSchema = $ofSchema.value;
      const schema = z.array(ofSchema);
      return Result.ok(schema);
    }
  ),
  object: type(
    Typed.extend({
      of: objectOf,
    }),
    ({ of: _of }) => fromObjectOf(_of)
  ),
  node: type(
    Typed.extend({
      of: z.object({ $id: z.string() }).passthrough(),
      with: objectOf.optional(),
    }),
    ({ of: _of, with: _with }) => {
      const type = _of.$id;
      const schema = Typed.extend({ $type: z.literal(type) });
      if (_with) {
        const $withSchema = fromObjectOf(_with);
        if (!$withSchema.ok) return Result.err("WITH").$cause($withSchema);
        const withSchema = $withSchema.value;
        return Result.ok(schema.merge(withSchema));
      }
      return Result.ok(schema);
    }
  ),
};

type ZodTypeAnyUnion = [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]];

typeDefinitions["type"] = type(Typed, () => {
  return z.union(
    Object.values(typeDefinitions).map((type) => type.schema) as ZodTypeAnyUnion
  );
});
