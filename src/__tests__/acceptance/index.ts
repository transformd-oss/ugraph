import { parse } from "ugraph";

describe("parse", () => {
  test("with objects/nodes/references/nested", () => {
    const $u = parse([
      {},
      { oA: "a" },
      { $id: "a" },
      { oB: "b", r: { $node: { $id: "b" } } },
      { $id: "c", r: { $node: "b" } },
    ]);

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

    expect(Array.from(u.values())[0]).toStrictEqual({});
    expect(Array.from(u.values())[1]).toStrictEqual({ oA: "a" });
    expect(Array.from(u.values())[2]).toStrictEqual(a);
    expect(Array.from(u.values())[3]["r"]).toStrictEqual(b);
    expect(Array.from(u.values())[4]["r"]).toStrictEqual(b);
  });
});
