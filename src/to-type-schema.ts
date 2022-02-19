import { Result } from "esresult";
import { z, ZodTypeAny } from "zod";
import { Instance } from "./graph";

export function toTypeSchema(
  inst: Instance
): Result<ZodTypeAny, "PROPS" | "SCHEMA" | "UNSUPPORTED"> {
  const type = inst.$type;
  const typeDefinition = types[type];
  if (!typeDefinition) return Result.err("UNSUPPORTED");

  const $props = typeDefinition.schema.safeParse(inst);
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

const instance = z.object({ $type: z.string() });

const types: Record<string, Type> = {
  string: type(instance, () => z.string()),
  number: type(instance, () => z.number()),
  boolean: type(instance, () => z.boolean()),
  array: type(
    instance.extend({
      of: instance.passthrough(),
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
    instance.extend({
      of: z.record(
        instance.extend({ required: z.boolean().optional() }).passthrough()
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
};

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
