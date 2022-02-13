import { parse } from "./graph";

test("outputs basic graph with only objects", () => {
  const u = parse([{ a: "1" }, { b: "2" }, { c: "3" }]);
  expect(u.size).toBe(3);
});
