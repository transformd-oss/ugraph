import { resolve } from "./resolve";
import { validate } from "./validate";

const data = [
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
];

const nodes = getNodes(data);

function getNodes(data: unknown) {
  const nodes = resolve({ data }).orUndefined()?.nodes;
  if (!nodes) throw TypeError();
  return nodes;
}

test("with no types", () => {
  const types = getNodes([]);
  const $valid = validate({ nodes, types });
  expect($valid.ok).toBeTruthy();
  if (!$valid.ok) throw TypeError();

  expect($valid.value.valid).toBeFalsy();
  if ($valid.value.valid) throw TypeError();
  expect($valid.value.issues).toHaveLength(2);
});

test("with all complete types", () => {
  const types = getNodes([
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
  ]);
  const $valid = validate({ nodes, types });
  expect($valid.ok).toBeTruthy();
  if (!$valid.ok) throw TypeError();

  expect($valid.value.valid).toBeTruthy();
});

test("with missing types", () => {
  const types = getNodes([
    {
      $id: "A",
      $type: "object",
      of: {},
    },
  ]);
  const $valid = validate({ nodes, types });
  expect($valid.ok).toBeTruthy();
  if (!$valid.ok) throw TypeError();

  expect($valid.value.valid).toBeFalsy();
  if ($valid.value.valid) throw TypeError();
  expect($valid.value.issues).toMatchObject([
    {
      id: "B:b:ki5j45k1qu",
      issue: { path: ["$type"] },
    },
  ]);
});

test("with incomplete types", () => {
  const types = getNodes([
    {
      $id: "A",
      $type: "object",
    },
  ]);
  const $valid = validate({ nodes, types });
  expect($valid.ok).toBeFalsy();
  if ($valid.ok) throw TypeError();

  expect($valid.error).toBe("TYPES");
});
