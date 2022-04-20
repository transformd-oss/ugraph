import { toTypeSchema } from "./to-type-schema";

test("with string", () => {
  const schema = toTypeSchema({ $type: "string" }).orThrow();
  expect(schema.safeParse("abc").success).toBeTruthy();
  expect(schema.safeParse(123).success).toBeFalsy();
});

test("with number", () => {
  const schema = toTypeSchema({ $type: "number" }).orThrow();
  expect(schema.safeParse(123).success).toBeTruthy();
  expect(schema.safeParse("abc").success).toBeFalsy();
});

test("with boolean", () => {
  const schema = toTypeSchema({ $type: "boolean" }).orThrow();
  expect(schema.safeParse(true).success).toBeTruthy();
  expect(schema.safeParse(false).success).toBeTruthy();
  expect(schema.safeParse(null).success).toBeFalsy();
});

test("with array", () => {
  const schema = toTypeSchema({
    $type: "array",
    of: { $type: "string" },
  }).orThrow();
  expect(schema.safeParse(["abc"]).success).toBeTruthy();
  expect(schema.safeParse([123]).success).toBeFalsy();
});

test("with incomplete array", () => {
  const $schema = toTypeSchema({ $type: "array" });
  expect($schema.error).toBeDefined();
});

test("with object", () => {
  const schema = toTypeSchema({
    $type: "object",
    of: { foo: { $type: "string" }, bar: { $type: "string", required: false } },
  }).orThrow();
  expect(schema.safeParse({}).success).toBeFalsy();
  expect(schema.safeParse({ foo: "abc" }).success).toBeTruthy();
  expect(schema.safeParse({ foo: "abc", bar: "abc" }).success).toBeTruthy();
  expect(schema.safeParse({ bar: "abc" }).success).toBeFalsy();
  expect(schema.safeParse({ foo: "abc", bar: 123 }).success).toBeFalsy();
});

test("with incomplete object", () => {
  const $schema = toTypeSchema({ $type: "object" });
  expect($schema.error).toBeDefined();
});

test("with node", () => {
  const schema = toTypeSchema({ $type: "node", of: { $id: "A" } }).orThrow();
  expect(schema.safeParse({ $type: "A" }).success).toBeTruthy();
  expect(schema.safeParse({ $type: "B" }).success).toBeFalsy();
});

test("with node with reference properties", () => {
  const schema = toTypeSchema({
    $type: "node",
    of: { $id: "A" },
    with: { name: { $type: "string" } },
  }).orThrow();
  expect(schema.safeParse({ $type: "A" }).success).toBeFalsy();
  expect(schema.safeParse({ $type: "A", name: "foobar" }).success).toBeTruthy();
  expect(schema.safeParse({ $type: "A", name: 123 }).success).toBeFalsy();
});

test("with node and invalid props", () => {
  const $schema = toTypeSchema({ $type: "node", of: "A" });
  expect($schema.error).toBeDefined();
});
