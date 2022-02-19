import { resolve } from "./resolve";

test("with only objects", () => {
  const data = [{ a: "1" }, { b: "2" }, { c: "3" }];
  const u = resolve({ data }).orUndefined();
  expect(u?.size).toBe(3);
  expect(u?.nodes.size).toBe(0);
  expect(Array.from(u?.values() ?? [])).toEqual(data);
});

test("with some nodes", () => {
  const data = [{ a: "1" }, { $id: "b:2", $type: "B" }];
  const u = resolve({ data }).orUndefined();
  expect(u?.size).toBe(2);
  expect(u?.nodes.size).toBe(1);
  expect(Array.from(u?.values() ?? [])).toEqual(data);
});

test("abort on node conflict", () => {
  const data = [{ $id: "a", $type: "A" }, { $id: "a" }];
  const $u = resolve({ data });
  expect($u.ok).toBeFalsy();
  if ($u.ok) return;
  expect($u.error).toBe("INVALID");
  expect($u.info.issues).toHaveLength(1);
  expect($u.info.issues[0]).toMatchObject({
    error: "NODE",
    info: { id: "a" },
  });
});

test("merge on node conflict", () => {
  const data = [
    { $id: "a", $type: "A", prop: "foo" },
    { $id: "a", prop: "bar" },
  ];
  const $u = resolve({ data, onConflict: "merge" });
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
  const $u = resolve({ data, onConflict: "ignore" });
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
  const $u = resolve({ data });
  const u = $u.value;
  expect($u.ok).toBeTruthy();
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
  const $u = resolve({ data });
  const u = $u.value;
  expect($u.ok).toBeTruthy();
  expect(u?.size).toBe(3);
  expect(u?.nodes.size).toBe(3);
  const a = u?.nodes.get("a:1");
  expect(a).toBeDefined();
  expect(u?.nodes.get("b:2")?.["a"]).toStrictEqual(a);
  expect(u?.nodes.get("c:3")?.["a"]).toStrictEqual(a);
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
  const $u = resolve({ data });
  expect($u.ok).toBeTruthy();
  expect(Array.from($u.value?.values() ?? [])[0]).toMatchObject({
    a: $u.value?.nodes.get("a:1"),
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
  const $u = resolve({ data });
  expect($u.ok).toBeFalsy();
  if ($u.ok) return;
  expect($u.info.issues).toHaveLength(3);
});
