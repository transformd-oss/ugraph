/* eslint-disable @typescript-eslint/no-namespace */

import Result from "esresult";
import { z, type ZodError, type ZodTypeAny } from "zod";

////////////////////////////////////////////////////////////////////////////////

export function _(
  options: {
    types?: _.Types | ReadonlyArray<_.Types>;
    useDefaultTypes?: boolean;
  } = {}
): Result<_.Parse> {
  const { types: _types, useDefaultTypes = true } = options;
  const { defaultTypes } = _;

  const typesets: ReadonlyArray<Record<string, Array<_.Type>>> = [
    ...(useDefaultTypes ? [defaultTypes] : []),
    ...(_types ? (Array.isArray(_types) ? _types : [_types]) : []),
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
  }, {}) as _.Types;

  return Result(function parse(options) {
    const { schema } = options;

    const { $type } = schema;
    const type = types[$type];
    if (!type) {
      return Result.error(["TypeUnsupported", { type: $type }]);
    }

    let zschema: ZodTypeAny | undefined;
    for (const item of type) {
      const $props = item.props?.safeParse(schema);
      if ($props && !$props.success) {
        return Result.error([
          "TypePropsInvalid",
          { issues: $props.error.issues },
        ]);
      }

      const props = $props?.data as unknown;
      const $zschema = item.build(props, { parse });
      if ($zschema.error) {
        return Result.error("TypeSchemaFailed", { cause: $zschema });
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

    return Result(zschema ?? z.never());
  });
}

export namespace _ {
  export interface Type {
    props: _.Type.Props;
    build: _.Type.Build;
  }

  export namespace Type {
    export type Props = ZodTypeAny | undefined;
    export type Build<PROPS = ZodTypeAny | undefined> = (
      props: PROPS extends ZodTypeAny ? z.infer<PROPS> : undefined,
      context: { parse: Parse }
    ) => Result<ZodTypeAny | undefined, unknown>;
  }

  export type Schema = { $type: string } & Record<string, unknown>;

  export type Types = Record<string, ReadonlyArray<_.Type>>;

  export type Parse = <SCHEMA extends _.Schema>(options: {
    schema: SCHEMA;
  }) => Result<
    ZodTypeAny,
    | ["TypeUnsupported", { type: string }]
    | ["TypePropsInvalid", { issues: ZodError["issues"] }]
    | ["TypeSchemaFailed"]
  >;
}

////////////////////////////////////////////////////////////////////////////////

function Type<PROPS extends _.Type.Props>(
  props: PROPS,
  build: _.Type.Build<PROPS>
): _.Type {
  return {
    props,
    build,
  };
}

_.Type = Type;

////////////////////////////////////////////////////////////////////////////////

const Schema = z.object({ $type: z.string() }).passthrough();

_.Schema = Schema;

////////////////////////////////////////////////////////////////////////////////

function parseArray(parse: _.Parse, of: _.Schema): Result<ZodTypeAny, "OF"> {
  const $ofschema = parse({ schema: of });
  if ($ofschema.error) {
    return Result.error("OF", { cause: $ofschema });
  }
  const ofschema = $ofschema.value;
  const schema = z.array(ofschema);
  return Result(schema);
}

function parseObject(
  parse: _.Parse,
  of: Record<string, _.Schema>
): Result<
  ZodTypeAny,
  ["OfKeyLookupFailed" | "OfKeySchemaFailed", { key: string }]
> {
  let schema = z.object({});
  for (const key in of) {
    const keyschema = of[key];
    if (!keyschema) {
      return Result.error(["OfKeyLookupFailed", { key }]);
    }
    const $valueSchema = parse({ schema: keyschema });
    if ($valueSchema.error) {
      return Result.error(["OfKeySchemaFailed", { key }], {
        cause: $valueSchema,
      });
    }

    let valueSchema = $valueSchema.value;
    const { required = true } = keyschema;
    if (!required) {
      valueSchema = valueSchema.optional();
    }

    schema = schema.extend({ [key]: valueSchema });
  }
  return Result(schema);
}

////////////////////////////////////////////////////////////////////////////////

const defaultTypes: _.Types = {
  string: [Type(undefined, () => Result(z.string()))],
  number: [Type(undefined, () => Result(z.number()))],
  boolean: [Type(undefined, () => Result(z.boolean()))],
  array: [
    Type(
      z.object({
        of: Schema,
      }),
      ({ of }, { parse }) => parseArray(parse, of)
    ),
  ],
  object: [
    Type(
      z.object({
        of: z.record(Schema),
      }),
      ({ of }, { parse }) => parseObject(parse, of)
    ),
  ],
  // TODO: For parsing the schema itself.
  // node: [
  //   Type(
  //     Typed.extend({
  //       of: z.object({ $id: z.string() }).passthrough(),
  //       edge: objectOf.optional(),
  //     }),
  //     ({ of, edge }, { parse }) => {
  //       const type = _of.$id;
  //       const schema = Typed.extend({ $type: z.literal(type) });
  //       if (with) {
  //         const $withSchema = fromObjectOf(_with);
  //         if ($withSchema.error) return Result.error("WITH").$cause($withSchema);
  //         const withSchema = $withSchema.value;
  //         return Result(schema.merge(withSchema));
  //       }
  //       return Result(schema);
  //     }
  //   ),
  // ],
};

_.defaultTypes = defaultTypes;
