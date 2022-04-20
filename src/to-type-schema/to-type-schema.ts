import Result from "esresult";
import { z, ZodTypeAny } from "zod";
import { Typed } from "../graph";

/**
 * @deprecated Use toZodSchema instead if possible.
 */
export function toTypeSchema(
  typed: Typed
): Result<ZodTypeAny, "PROPS" | "SCHEMA" | ["UNSUPPORTED", { type: string }]> {
  const type = typed.$type;
  const typeDefinition = typeDefinitions[type];
  if (!typeDefinition) {
    return Result.error(["UNSUPPORTED", { type }]);
  }

  const $props = typeDefinition.schema.safeParse(typed);
  if (!$props.success) {
    return Result.error("PROPS", { cause: $props.error });
  }

  const props = $props.data;
  const $schema = typeDefinition.build(props);
  if ("error" in $schema) {
    if ($schema.error) {
      return Result.error("SCHEMA", { cause: $schema });
    }
    return Result($schema.value);
  }

  const schema = $schema;
  return Result(schema);
}

/////////////////////////////

interface Type<SCHEMA extends ZodTypeAny = ZodTypeAny> {
  schema: SCHEMA;
  build(props: z.infer<SCHEMA>): ZodTypeAny | Result<ZodTypeAny, unknown>;
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
): Result<z.AnyZodObject, ["KEY_VALUE" | "KEY_LOOKUP", { key: string }]> {
  let schema = z.object({});
  for (const key in _of) {
    const value = _of[key];
    if (!value) {
      return Result.error(["KEY_LOOKUP", { key }]);
    }
    const $valueSchema = toTypeSchema(value);
    if ($valueSchema.error)
      return Result.error(["KEY_VALUE", { key }], { cause: $valueSchema });
    let [valueSchema] = $valueSchema;
    const { required = true } = value;
    if (!required) valueSchema = valueSchema.optional();
    schema = schema.extend({ [key]: valueSchema });
  }
  return Result(schema);
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
      if ($ofSchema.error) return Result.error("OF", { cause: $ofSchema });
      const ofSchema = $ofSchema.value;
      const schema = z.array(ofSchema);
      return Result(schema);
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
        if ($withSchema.error)
          return Result.error("WITH", { cause: $withSchema });
        const withSchema = $withSchema.value;
        return Result(schema.merge(withSchema));
      }
      return Result(schema);
    }
  ),
};

type ZodTypeAnyUnion = [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]];

typeDefinitions["type"] = type(Typed, () => {
  return z.union(
    Object.values(typeDefinitions).map((type) => type.schema) as ZodTypeAnyUnion
  );
});
