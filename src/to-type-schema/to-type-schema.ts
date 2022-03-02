import { Result } from "esresult";
import { z, ZodTypeAny } from "zod";
import { Typed } from "../graph";

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
      of: z.record(
        Typed.extend({ required: z.boolean().optional() }).passthrough()
      ),
    }),
    ({ of: _of }) => {
      let schema = z.object({});
      for (const key in _of) {
        const value = _of[key];
        const $valueSchema = toTypeSchema(value);
        if (!$valueSchema.ok)
          return Result.err("OF").$cause($valueSchema).$info({ key });
        let valueSchema = $valueSchema.value;
        const { required = true } = value;
        if (!required) valueSchema = valueSchema.optional();
        schema = schema.extend({ [key]: valueSchema });
      }
      return Result.ok(schema);
    }
  ),
  node: type(
    Typed.extend({
      of: z.object({ $id: z.string() }).passthrough(),
    }),
    ({ of: _of }) => {
      const type = _of.$id;
      return Typed.extend({ $type: z.literal(type) });
    }
  ),
};

type ZodTypeAnyUnion = [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]];

typeDefinitions.type = type(Typed, () => {
  return z.union(
    Object.values(typeDefinitions).map((type) => type.schema) as ZodTypeAnyUnion
  );
});
