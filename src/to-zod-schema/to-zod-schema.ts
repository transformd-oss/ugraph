import { Result } from "esresult";
import { z, type ZodError, type ZodTypeAny } from "zod";

////////////////////////////////////////////////////////////////////////////////

export function toZodSchema(options: {
  types: Types | ReadonlyArray<Types>;
  useDefaultTypes?: boolean;
}): Result<Walk> {
  const { types: _types, useDefaultTypes = true } = options;
  const { defaultTypes } = toZodSchema;

  const typesets: ReadonlyArray<Record<string, Array<Type>>> = [
    ...(useDefaultTypes ? [defaultTypes] : []),
    ...(Array.isArray(_types) ? _types : [_types]),
  ];

  const types = typesets.reduce((acc, typeset) => {
    for (const [key, value] of Object.entries(typeset)) {
      const currentValue = acc[key];
      if (currentValue) {
        currentValue.push(...value);
      } else {
        acc[key] = [...value];
      }
    }
    return acc;
  }, {}) as Types;

  return Result.ok(function walk(options) {
    const { schema } = options;

    const { $type } = schema;
    const type = types[$type];
    if (!type) {
      return Result.err("TypeUnsupported").$info({
        type: $type,
      });
    }

    let zschema: ZodTypeAny | undefined;
    for (const item of type) {
      const $props = item.props?.safeParse(schema);
      if ($props && !$props.success) {
        return Result.err("TypePropsInvalid").$info({
          issues: $props.error.issues,
        });
      }

      const props = $props?.data as unknown;
      const $zschema = item.build(props, { walk });
      if (!$zschema.ok) {
        return Result.err("TypeSchemaFailed").$cause($zschema);
      }

      const nextzschema = $zschema.value;
      if (!nextzschema) {
        continue;
      }

      if (zschema) {
        zschema = z.intersection(zschema, nextzschema);
      }

      zschema = nextzschema;
    }

    return Result.ok(zschema ?? z.never());
  });
}

////////////////////////////////////////////////////////////////////////////////

export interface Type {
  props: Type.Props;
  build: Type.Build;
  partial: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Type {
  export type Props = ZodTypeAny | undefined;
  export type Build<PROPS = ZodTypeAny | undefined> = (
    props: PROPS extends ZodTypeAny ? z.infer<PROPS> : undefined,
    context: { walk: Walk }
  ) => Result<ZodTypeAny | undefined>;
}

function Type<PROPS extends Type.Props>(
  props: PROPS,
  build: Type.Build<PROPS>,
  options?: { partial?: boolean }
): Type {
  return {
    props,
    build,
    partial: options?.partial ?? false,
  };
}

toZodSchema.Type = Type;

////////////////////////////////////////////////////////////////////////////////

export type Schema = { $type: string } & Record<string, unknown>;

export const Schema = z.object({ $type: z.string() }).passthrough();

toZodSchema.Schema = Schema;

////////////////////////////////////////////////////////////////////////////////

export type Types = Record<string, ReadonlyArray<Type>>;

////////////////////////////////////////////////////////////////////////////////

export type Walk = <SCHEMA extends Schema>(options: {
  /**
   *
   */
  schema: SCHEMA;
  /**
   *
   */
  path?: ReadonlyArray<string>;
}) => Result<
  ZodTypeAny,
  | Result.Err<"TypeUnsupported", { type: string }>
  | Result.Err<"TypePropsInvalid", { issues: ZodError["issues"] }>
  | Result.Err<"TypeSchemaFailed">
>;

////////////////////////////////////////////////////////////////////////////////

function walkArray(walk: Walk, of: Schema): Result<ZodTypeAny> {
  const $ofschema = walk({ schema: of });
  if (!$ofschema.ok) return Result.err("OF").$cause($ofschema);
  const ofschema = $ofschema.value;
  const schema = z.array(ofschema);
  return Result.ok(schema);
}

function walkObject(
  walk: Walk,
  of: Record<string, Schema>
): Result<ZodTypeAny> {
  let schema = z.object({});
  for (const key in of) {
    const keyschema = of[key];
    const $valueSchema = walk({ schema: keyschema });
    if (!$valueSchema.ok) {
      return Result.err("OfKeySchemaFailed")
        .$cause($valueSchema)
        .$info({ key });
    }

    let valueSchema = $valueSchema.value;
    const { required = true } = keyschema;
    if (!required) {
      valueSchema = valueSchema.optional();
    }

    schema = schema.extend({ [key]: valueSchema });
  }
  return Result.ok(schema);
}

////////////////////////////////////////////////////////////////////////////////

const defaultTypes: Types = {
  string: [Type(undefined, () => Result.ok(z.string()))],
  number: [Type(undefined, () => Result.ok(z.number()))],
  boolean: [Type(undefined, () => Result.ok(z.boolean()))],
  array: [
    Type(
      z.object({
        of: Schema,
      }),
      ({ of }, { walk }) => walkArray(walk, of)
    ),
  ],
  object: [
    Type(
      z.object({
        of: z.record(Schema),
      }),
      ({ of }, { walk }) => walkObject(walk, of)
    ),
  ],
  // TODO: For parsing the schema itself.
  // node: [
  //   Type(
  //     Typed.extend({
  //       of: z.object({ $id: z.string() }).passthrough(),
  //       edge: objectOf.optional(),
  //     }),
  //     ({ of, edge }, { walk }) => {
  //       const type = _of.$id;
  //       const schema = Typed.extend({ $type: z.literal(type) });
  //       if (with) {
  //         const $withSchema = fromObjectOf(_with);
  //         if (!$withSchema.ok) return Result.err("WITH").$cause($withSchema);
  //         const withSchema = $withSchema.value;
  //         return Result.ok(schema.merge(withSchema));
  //       }
  //       return Result.ok(schema);
  //     }
  //   ),
  // ],
};

toZodSchema.defaultTypes = defaultTypes;