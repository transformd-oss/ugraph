import { parse } from "./parse";

it("should parse basic objects", () => {
  const data = [{ a: 1 }, { b: 2 }, { c: 3 }];
  const u = parse({ data }).orThrow();
  expect(u.data).toHaveLength(3);
  expect(u.data).toMatchObject([{ a: 1 }, { b: 2 }, { c: 3 }]);
  expect(u.nodes.size).toBe(0);
});

it("should parse basic nodes amongst objects", () => {
  const data = [{ $id: "A" }, { x: 1 }];
  const u = parse({ data }).orThrow();
  expect(u.data).toHaveLength(2);
  expect(u.data).toMatchObject([{ $id: "A" }, { x: 1 }]);
  expect(u.nodes.size).toBe(1);
  expect(u.nodes.get("A")).toBeDefined();
});

it("should fail on node conflict", () => {
  const data = [{ $id: "A" }, { $id: "A" }];
  const $ = parse({ data });
  expect($).toMatchObject({
    error: {
      type: "DataInvalid",
      meta: {
        errors: [
          {
            error: {
              type: "NodeIdConflict",
              meta: {
                path: ["1"],
                id: "A",
                conflictPath: ["0"],
              },
            },
          },
        ],
      },
    },
  });
});

it("should merge on node conflict", () => {
  const data = [
    { $id: "A", prop: "foo" },
    { $id: "A", prop: "bar" },
  ];
  const u = parse({ data, onConflict: "merge" }).orThrow();
  expect(u.nodes.size).toBe(1);
  expect(u.nodes.get("A")).toMatchObject({
    $id: "A",
    prop: "bar",
  });
});

it("should ignore on node conflict", () => {
  const data = [
    { $id: "A", prop: "foo" },
    { $id: "A", prop: "bar" },
  ];
  const u = parse({ data, onConflict: "ignore" }).orThrow();
  expect(u.nodes.size).toBe(1);
  expect(u.nodes.get("A")).toMatchObject({
    $id: "A",
    prop: "foo",
  });
});

it("should parse nested nodes", () => {
  const data = [
    {
      $id: "A",
      prop: {
        $node: {
          $id: "B",
          prop: {
            $node: { $id: "C" },
          },
        },
      },
    },
  ];
  const u = parse({ data }).orThrow();
  expect(u.data).toHaveLength(1);
  expect(u.data).toMatchObject([
    {
      $id: "A",
      prop: {
        $id: "B",
        prop: {
          $id: "C",
        },
      },
    },
  ]);
  expect(u.nodes.size).toBe(3);
  expect(u.nodes.get("A")).toMatchObject({ $id: "A" });
  expect(u.nodes.get("B")).toMatchObject({ $id: "B" });
  expect(u.nodes.get("C")).toMatchObject({ $id: "C" });

  // strict equality

  const a = u.nodes.get("A");
  const b = u.nodes.get("B");

  expect(a).toBeDefined();
  expect(b).toBeDefined();
  expect(a?.["prop"]).toBe(b);
});

it("should map props references of a simple object", () => {
  const data = [
    {
      prop: { $node: "A" },
    },
    {
      $id: "A",
    },
  ];
  const u = parse({ data }).orThrow();
  expect(u.nodes.size).toBe(1);
  const a = u.nodes.get("A");
  expect(a).toBeDefined();
  expect((u.data as typeof data)[0]).toMatchObject({ prop: a });
});

it("should map prop references across nodes", () => {
  const data = [
    {
      $id: "A",
    },
    {
      $id: "B",
      prop: { $node: "A" },
    },
    {
      $id: "C",
      prop: { $node: "B" },
    },
    {
      $id: "D",
      prop: { $node: "D" },
    },
  ];
  const u = parse({ data }).orThrow();
  expect(u.data).toHaveLength(4);
  expect(u.nodes.size).toBe(4);
  const a = u.nodes.get("A");
  const b = u.nodes.get("B");
  const c = u.nodes.get("C");
  const d = u.nodes.get("D");

  expect(a).toBeDefined();
  expect(b).toBeDefined();
  expect(c).toBeDefined();
  expect(d).toBeDefined();

  expect(b?.["prop"]).toBe(a);
  expect(c?.["prop"]).toBe(b);
  expect(d?.["prop"]).toBe(d);
});

it("should fail with bad references", () => {
  const data = [
    {
      a: { $node: "A" },
      b: { $node: "B" },
      c: { $node: "C" },
    },
  ];
  const $ = parse({ data });
  expect($).toMatchObject({
    error: {
      type: "DataInvalid",
      meta: {
        errors: [
          {
            error: {
              type: "NodeReferenceBroken",
              meta: {
                path: ["0", "a"],
                id: "A",
              },
            },
          },
          {
            error: {
              type: "NodeReferenceBroken",
              meta: {
                path: ["0", "b"],
                id: "B",
              },
            },
          },
          {
            error: {
              type: "NodeReferenceBroken",
              meta: {
                path: ["0", "c"],
                id: "C",
              },
            },
          },
        ],
      },
    },
  });
});
