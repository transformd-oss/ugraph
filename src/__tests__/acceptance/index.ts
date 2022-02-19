import { parse } from "ugraph";

describe("parse", () => {
  test("with objects/nodes/references/nested", () => {
    const $u = parse({
      data: [
        {},
        { oA: "a" },
        { $id: "a" },
        { oB: "b", r: { $node: { $id: "b" } } },
        { $id: "c", r: { $node: "b" } },
      ],
    });

    expect($u.ok).toBeTruthy();

    const u = $u.value;
    expect(u).toBeDefined();
    if (!u) return;

    expect(u.nodes.size).toBe(3);

    const a = u.nodes.get("a");
    expect(a).toBeDefined();
    const b = u.nodes.get("b");
    expect(b).toBeDefined();
    const c = u.nodes.get("c");
    expect(c).toBeDefined();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = u.data as any;
    expect(data[0]).toStrictEqual({});
    expect(data[1]).toStrictEqual({ oA: "a" });
    expect(data[2]).toBe(a);
    expect(data[3]["r"]).toBe(b);
    expect(data[4]["r"]).toBe(b);
  });

  test("with type definitions", () => {
    const $u = parse({
      data: [
        { $id: "foo", $type: "A" },
        { $type: "A", a: "abc" },
        { $type: "B", a: { $node: "foo" } },
      ],
      types: [
        {
          $id: "A",
          $type: "object",
          of: { a: { $type: "string", required: false } },
        },
        {
          $id: "B",
          $type: "object",
          of: { a: { $type: "node", of: { $node: "A" } } },
        },
      ],
    });

    expect($u.ok).toBeTruthy();

    const u = $u.value;
    expect(u).toBeDefined();
    if (!u) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = u.data as any;
    expect(data).toMatchObject([
      { $id: "foo", $type: "A" },
      { $type: "A", a: "abc" },
      {
        $type: "B",
        a: { $id: "foo", $type: "A" },
      },
    ]);
  });
});
