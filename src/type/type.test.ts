import { expectType } from "tsd";
import * as Type from "./type";

test("types", () => {
  expect(true).toBeTruthy();
});

/**
 * EMPTY
 */

{
  const $ = {};
  // @ts-expect-error Can't assign anything to `never`.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * STRING
 */

{
  const $ = { $type: "string" } as const;
  expectType<Type.Infer<typeof $>>("");
  expectType<Type.Infer<typeof $>>("abc");
  // @ts-expect-error Must be string.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * NUMBER
 */

{
  const $ = { $type: "number" } as const;
  expectType<Type.Infer<typeof $>>(0);
  expectType<Type.Infer<typeof $>>(123);
  expectType<Type.Infer<typeof $>>(NaN);
  // @ts-expect-error Must be number.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * BOOLEAN
 */

{
  const $ = { $type: "boolean" } as const;
  expectType<Type.Infer<typeof $>>(true);
  expectType<Type.Infer<typeof $>>(false);
  // @ts-expect-error Must be boolean.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * OBJECT
 */

{
  const $ = { $type: "object", of: {} } as const;
  expectType<Type.Infer<typeof $>>({});
  // @ts-expect-error Must have no members.
  expectType<Type.Infer<typeof $>>({ foo: "string" });
  // @ts-expect-error Must be object.
  expectType<Type.Infer<typeof $>>(null);
}
{
  const $ = { $type: "object", of: { foo: { $type: "string" } } } as const;
  expectType<Type.Infer<typeof $>>({ foo: "string" });
  // @ts-expect-error Must have "bar" property.
  expectType<Type.Infer<typeof $>>({});
  // @ts-expect-error Must be object.
  expectType<Type.Infer<typeof $>>(null);
}
{
  const $ = {
    $type: "object",
    of: {
      foo: { $type: "string", required: false },
      bar: { $type: "number", required: false },
    },
  } as const;
  expectType<Type.Infer<typeof $>>({});
  expectType<Type.Infer<typeof $>>({ foo: "abc", bar: 123 });
  // @ts-expect-error Must be object.
  expectType<Type.Infer<typeof $>>(null);
}
{
  const $ = {
    $type: "object",
    of: {
      foo: { $type: "string" },
      bar: { $type: "number", required: false },
    },
  } as const;
  expectType<Type.Infer<typeof $>>({ foo: "abc" });
  expectType<Type.Infer<typeof $>>({ foo: "abc", bar: 123 });
  // @ts-expect-error Must have "foo" property.
  expectType<Type.Infer<typeof $>>({});
  // @ts-expect-error Must have "foo" property.
  expectType<Type.Infer<typeof $>>({ bar: 123 });
  // @ts-expect-error Must have "foo" property of correct type.
  expectType<Type.Infer<typeof $>>({ foo: 123 });
  // @ts-expect-error Must be object.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * ARRAY
 */

{
  const $ = {
    $type: "array",
    of: { $type: "string" },
  } as const;
  expectType<Type.Infer<typeof $>>([]);
  expectType<Type.Infer<typeof $>>(["a", "b", "c"]);
  // @ts-expect-error Must be array of `string` items.
  expectType<Type.Infer<typeof $>>([1, 2, 3]);
  // @ts-expect-error Must be array.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * UNION
 */

{
  const $ = {
    $type: "union",
    of: [{ $type: "string" }],
  } as const;
  expectType<Type.Infer<typeof $>>("a");
  // @ts-expect-error Must be `string`.
  expectType<Type.Infer<typeof $>>(null);
}
{
  const $ = {
    $type: "union",
    of: [{ $type: "string" }, { $type: "number" }],
  } as const;
  expectType<Type.Infer<typeof $>>("abc");
  expectType<Type.Infer<typeof $>>(123);
  // @ts-expect-error Must be `string` or `number`.
  expectType<Type.Infer<typeof $>>(null);
}
{
  const $ = {
    $type: "array",
    of: {
      $type: "union",
      of: [{ $type: "string" }, { $type: "number" }],
    },
  } as const;
  expectType<Type.Infer<typeof $>>([]);
  expectType<Type.Infer<typeof $>>(["a", 1, "b", 2, "c", 3]);
  // @ts-expect-error Must be array of `string` or `number` items.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * RECORD
 */

{
  const $ = {
    $type: "record",
    of: { $type: "string" },
  } as const;
  expectType<Type.Infer<typeof $>>({});
  expectType<Type.Infer<typeof $>>({ a: "1", b: "2" });
  // @ts-expect-error All properties must have `string` values.
  expectType<Type.Infer<typeof $>>({ a: 1, b: "2" });
  // @ts-expect-error Must be object/record.
  expectType<Type.Infer<typeof $>>(null);
}
{
  const $ = {
    $type: "record",
    of: { $type: "union", of: [{ $type: "string" }, { $type: "number" }] },
  } as const;
  expectType<Type.Infer<typeof $>>({});
  expectType<Type.Infer<typeof $>>({ a: "1", b: "2", aN: 1, bN: 2 });
  // @ts-expect-error Must be object/record.
  expectType<Type.Infer<typeof $>>(null);
}
{
  const $ = {
    $type: "record",
    of: {
      $type: "array",
      of: {
        $type: "union",
        of: [
          { $type: "string" },
          {
            $type: "object",
            of: {
              firstName: { $type: "string", required: false },
              lastName: { $type: "string", required: false },
            },
          },
        ],
      },
    },
  } as const;
  expectType<Type.Infer<typeof $>>({});
  expectType<Type.Infer<typeof $>>({ set1: [], set2: [] });
  expectType<Type.Infer<typeof $>>({
    set1: [{}, {}],
    set2: [{ firstName: "foo", lastName: "bar" }],
    set3: ["fullname", { firstName: "partial" }],
  });
  // @ts-expect-error Must match shape.
  expectType<Type.Infer<typeof $>>(null);
}

/**
 * NODE
 */

{
  type Map = { MyNode: MyNode };
  type MyNode = { foo: string; bar: number };
  // As Reference.
  const $ = { $type: "node", of: { $node: "MyNode" } } as const;

  expectType<Type.Infer<typeof $, Map>>({} as MyNode);
  expectType<Type.Infer<typeof $, Map>>({ foo: "abc", bar: 123 });
  // @ts-expect-error Must be of type MyNode.
  expectType<Type.Infer<typeof $>>(null);
}
{
  type MyNode = { foo: string; bar: number };
  // As Inline Def/Ref.
  const $ = {
    $type: "node",
    of: {
      $node: {
        $id: "MyNode",
        $type: "object",
        of: {
          foo: { $type: "string" },
          bar: { $type: "number" },
        },
      },
    },
  } as const;

  expectType<Type.Infer<typeof $>>({} as MyNode);
  expectType<Type.Infer<typeof $>>({ foo: "abc", bar: 123 });
  // @ts-expect-error Must be of type MyNode.
  expectType<Type.Infer<typeof $>>(null);
}
{
  type MyNode = { foo: string; bar: number };
  // As Object.
  const $ = {
    $type: "node",
    of: {
      $type: "object",
      of: {
        foo: { $type: "string" },
        bar: { $type: "number" },
      },
    },
  } as const;

  expectType<Type.Infer<typeof $>>({} as MyNode);
  expectType<Type.Infer<typeof $>>({ foo: "abc", bar: 123 });
  // @ts-expect-error Must be of type MyNode.
  expectType<Type.Infer<typeof $>>(null);
}
{
  type Collection = {
    name: string;
    fields: Field[];
  };
  type Field = {
    name: string;
  };
  // With Deep References.
  const $ = {
    $id: "Collection",
    $type: "object",
    of: {
      name: { $type: "string" },
      fields: { $type: "array", of: { $type: "node", of: { $node: "Field" } } },
    },
  } as const;

  expectType<Type.Infer<typeof $, { Field: Field }>>({} as Collection);
  // @ts-expect-error Must be of type MyNode.
  expectType<Type.Infer<typeof $>>(null);
}
