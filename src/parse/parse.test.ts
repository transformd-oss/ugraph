import { Obj } from "../graph";
import { parse } from "./parse";

test("with only objects", () => {
  const data = [{ a: "1" }, { b: "2" }, { c: "3" }];
  const u = parse({ data }).orUndefined();
  expect(u?.data).toHaveLength(3);
  expect(u?.nodes.size).toBe(0);
  expect(Array.from(u?.data as typeof data)).toEqual(data);
});

test("with some nodes", () => {
  const data = [{ a: "1" }, { $id: "b:2", $type: "B" }];
  const u = parse({ data }).orUndefined();
  expect(u?.data).toHaveLength(2);
  expect(u?.nodes.size).toBe(1);
  expect(Array.from(u?.data as typeof data)).toEqual(data);
});

test("abort on node conflict", () => {
  const data = [{ $id: "a", $type: "A" }, { $id: "a" }];
  const $u = parse({ data });
  expect($u.ok).toBeFalsy();
  if ($u.ok) return;
  expect($u).toMatchObject({
    error: "DATA_INVALID",
    info: {
      errors: [
        {
          error: "NODE_CONFLICT",
          info: { path: ["1"] },
        },
      ],
    },
  });
});

test("merge on node conflict", () => {
  const data = [
    { $id: "a", $type: "A", prop: "foo" },
    { $id: "a", prop: "bar" },
  ];
  const $u = parse({ data, onConflict: "merge" });
  expect($u.ok).toBeTruthy();
  expect($u.value?.nodes.get("a")).toMatchObject({
    $id: "a",
    $type: "A",
    prop: "bar",
  });
});

test("ignore on node conflict", () => {
  const data = [
    { $id: "a", $type: "A", prop: "foo" },
    { $id: "a", prop: "bar" },
  ];
  const $u = parse({ data, onConflict: "ignore" });
  expect($u.ok).toBeTruthy();
  expect($u.value?.nodes.get("a")).toMatchObject({
    $id: "a",
    $type: "A",
    prop: "foo",
  });
});

test("with some nested nodes", () => {
  const data = [
    {
      $id: "a:1",
      $type: "A",
      b: {
        $node: {
          $id: "b:2",
          $type: "B",
          c: { $node: { $id: "c:3", $type: "C" } },
        },
      },
    },
  ];
  const $u = parse({ data });
  const u = $u.value;
  expect($u.ok).toBeTruthy();
  expect(u?.data).toHaveLength(1);
  expect(u?.nodes.size).toBe(3);
  expect(u?.data).toMatchObject([
    {
      $id: "a:1",
      $type: "A",
      b: {
        $id: "b:2",
        $type: "B",
        c: { $id: "c:3", $type: "C" },
      },
    },
  ]);
});

test("with many references to one node", () => {
  const data = [
    {
      $id: "a:1",
      $type: "A",
    },
    {
      $id: "b:2",
      $type: "B",
      a: { $node: "a:1" },
    },
    {
      $id: "c:3",
      $type: "c",
      a: { $node: "a:1" },
    },
  ];
  const $u = parse({ data });
  const u = $u.value;
  expect($u.ok).toBeTruthy();
  expect(u?.data).toHaveLength(3);
  expect(u?.nodes.size).toBe(3);
  const a = u?.nodes.get("a:1");
  expect(a).toBeDefined();
  expect(u?.nodes.get("b:2")?.["a"]).not.toStrictEqual(a);
  expect((u?.nodes.get("b:2")?.["a"] as Obj)["$node"]).toStrictEqual(a);
});

test("with references on a simple object", () => {
  const data = [
    {
      a: { $node: "a:1" },
    },
    {
      $id: "a:1",
      $type: "A",
      foo: "bar",
    },
  ];
  const $u = parse({ data });
  expect($u.ok).toBeTruthy();
  if (!$u.ok) return;

  expect(($u.value.data as typeof data)[0]).toMatchObject({
    a: $u.value.nodes.get("a:1"),
  });
});

test("with references in nested object data structure", () => {
  const data = [
    {
      $id: "A",
      $type: "object",
      of: {
        prop: { $type: "node", of: { $node: "B" } },
      },
    },
    {
      $id: "B",
      $type: "object",
      of: {},
    },
  ];
  const $u = parse({ data });
  expect($u).toMatchObject({ ok: true });
  expect($u.value?.nodes.get("A")).toMatchObject({
    $id: "A",
    $type: "object",
    of: {
      prop: { $type: "node", of: $u.value?.nodes.get("B") },
    },
  });
});

test("with bad references", () => {
  const data = [
    {
      a: { $node: "a:1" },
      b: { $node: "b:2" },
      c: { $node: "c:3" },
    },
  ];
  const $u = parse({ data });
  expect($u).toMatchObject({
    ok: false,
    error: "DATA_INVALID",
    info: {
      errors: [{}, {}, {}],
    },
  });
});

test("with all complete types", () => {
  const $u = parse({
    data: [
      {
        $id: "A:a:rlmpnimf6v",
        $type: "A",
        name: "a",
        prop1: "abc",
        prop2: 123,
        prop3: true,
        prop4: { $node: "B:b:ki5j45k1qu" },
      },
      {
        $id: "B:b:ki5j45k1qu",
        $type: "B",
        name: "b",
      },
    ],
    types: [
      {
        $id: "A",
        $type: "object",
        of: {
          name: { $type: "string" },
          prop1: { $type: "string" },
          prop2: { $type: "number" },
          prop3: { $type: "boolean" },
          prop4: { $type: "node", of: { $node: "B" } },
        },
      },
      {
        $id: "B",
        $type: "object",
        of: {
          name: { $type: "string" },
        },
      },
    ],
  });
  expect($u).toMatchObject({
    ok: true,
  });
});

test("with missing types", () => {
  const $u = parse({
    data: [
      {
        $id: "A:a:rlmpnimf6v",
        $type: "A",
      },
      {
        $id: "B:b:ki5j45k1qu",
        $type: "B",
      },
    ],
    types: [
      {
        $id: "A",
        $type: "object",
        of: {},
      },
    ],
  });
  expect($u).toMatchObject({
    ok: false,
    error: "DATA_INVALID",
    info: {
      errors: [
        {
          error: "TYPED_INVALID_TYPE",
          info: { path: ["1"] },
        },
      ],
    },
  });
});

test("with incomplete types", () => {
  const $u = parse({
    data: [],
    types: [
      {
        $id: "A",
        $type: "object",
      },
    ],
  });
  expect($u).toMatchObject({
    ok: false,
    error: "TYPES_INVALID",
    info: {
      errors: [
        {
          error: "INVALID_PROPS",
          info: {
            id: "A",
          },
        },
      ],
    },
  });
});

test("with invalid data", () => {
  const $u = parse({
    data: [
      { $id: "foo", $type: "Foo" },
      { $id: "bar", $type: "Bar", foo: "foo" },
    ],
    types: [
      {
        $id: "Foo",
        $type: "object",
        of: {},
      },
      {
        $id: "Bar",
        $type: "object",
        of: { foo: { $type: "node", of: { $node: "Foo" } } },
      },
    ],
  });
  expect($u).toMatchObject({
    ok: false,
    error: "DATA_INVALID",
    info: {
      errors: [{ error: "TYPED_INVALID_PROPS", info: { path: ["1"] } }],
    },
  });
});

const Field_user = {
  $id: "A",
  $type: "Field",
  name: "user",
  valueType: {
    $type: "object",
    of: {
      name: { $node: "Name" },
      age: { $type: "number" },
      address: { $node: "Address" },
    },
  },
};
const object_Address = {
  $id: "Address",
  $type: "object",
  of: {
    line1: { $type: "string" },
    line2: { $type: "string" },
    city: { $type: "string" },
    state: { $type: "string" },
    postcode: { $type: "string" },
    country: { $type: "string" },
  },
};
const string_Name = {
  $id: "Name",
  $type: "string",
};

test("with type definition data properties", () => {
  const $u = parse({
    data: [Field_user, object_Address, string_Name],
    types: [
      {
        $id: "Field",
        $type: "object",
        of: {
          name: { $type: "string" },
          valueType: { $type: "type" },
        },
      },
    ],
  });
  expect($u).toMatchObject({
    ok: true,
  });
});

test("with type definition invalid data properties", () => {
  const $u = parse({
    data: [
      { ...Field_user, name: { $node: "Name" } }, // should be string
      object_Address,
      string_Name,
    ],
    types: [
      {
        $id: "Field",
        $type: "object",
        of: {
          name: { $type: "string" },
          valueType: { $type: "type" },
        },
      },
    ],
  });
  expect($u).toMatchObject({
    ok: false,
    error: "DATA_INVALID",
    info: {
      errors: [
        {
          error: "TYPED_INVALID_PROPS",
          info: {
            issues: [{ path: ["name"] }],
          },
        },
      ],
    },
  });
});
