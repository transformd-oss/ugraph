import { parse } from "./graph";

test("with only objects", () => {
  const graph = [{ a: "1" }, { b: "2" }, { c: "3" }];
  const u = parse(graph).value;
  expect(u?.size).toBe(3);
  expect(u?.nodes.size).toBe(0);
  expect(Array.from(u?.values() ?? [])).toEqual(graph);
});

test("with some nodes", () => {
  const graph = [{ a: "1" }, { $id: "b:2", $type: "B" }];
  const u = parse(graph).value;
  expect(u?.size).toBe(2);
  expect(u?.nodes.size).toBe(1);
  expect(Array.from(u?.values() ?? [])).toEqual(graph);
});

test("abort on node conflict", () => {
  const graph = [{ $id: "a", $type: "A" }, { $id: "a" }];
  const $u = parse(graph);
  expect($u.ok).toBeFalsy();
  expect($u.error).toBe("BAD_NODE");
  expect(!$u.ok && $u.cause()).toMatchObject({ error: "CONFLICT" });
});

test("merge on node conflict", () => {
  const graph = [
    { $id: "a", $type: "A", prop: "foo" },
    { $id: "a", prop: "bar" },
  ];
  const $u = parse(graph, { onNodeConflict: "merge" });
  expect($u.ok).toBeTruthy();
  expect($u.value?.nodes.get("a")).toMatchObject({
    $id: "a",
    $type: "A",
    prop: "bar",
  });
});

test("ignore on node conflict", () => {
  const graph = [
    { $id: "a", $type: "A", prop: "foo" },
    { $id: "a", prop: "bar" },
  ];
  const $u = parse(graph, { onNodeConflict: "ignore" });
  expect($u.ok).toBeTruthy();
  expect($u.value?.nodes.get("a")).toMatchObject({
    $id: "a",
    $type: "A",
    prop: "foo",
  });
});

test("with some nested nodes", () => {
  const graph = [
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
  const $u = parse(graph);
  const u = $u.value;
  expect($u.ok).toBeTruthy();
  expect($u.ok && $u.warnings()).toBeUndefined();
  expect(u?.size).toBe(1);
  expect(u?.nodes.size).toBe(3);
  expect(Array.from(u?.values() ?? [])).toEqual([
    {
      $id: "a:1",
      $type: "A",
      b: { $id: "b:2", $type: "B", c: { $id: "c:3", $type: "C" } },
    },
  ]);
});

test("with many references to one node", () => {
  const graph = [
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
  const $u = parse(graph);
  const u = $u.value;
  expect($u.ok).toBeTruthy();
  expect($u.ok && $u.warnings()).toBeUndefined();
  expect(u?.size).toBe(3);
  expect(u?.nodes.size).toBe(3);
  const a = u?.nodes.get("a:1");
  expect(a).toBeDefined();
  expect(u?.nodes.get("b:2")?.["a"]).toStrictEqual(a);
  expect(u?.nodes.get("c:3")?.["a"]).toStrictEqual(a);
});
