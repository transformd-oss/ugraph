import { parse } from "./src/index";

const $u = parse({
  data: [
    { $id: "product:1", $type: "Product", name: "vanilla" },
    { $id: "product:2", $type: "Product", name: "chocolate" },
    {
      $id: "company:x",
      $type: "Company",
      products: [{ $node: "product:1" }, { $node: "product:2" }],
    },
  ],
  types: [
    {
      $id: "Product",
      $type: "object",
      of: {
        name: { $type: "string" },
      },
    },
    {
      $id: "Company",
      $type: "object",
      of: {
        products: { $type: "array", of: { $node: "Product" } },
      },
    },
  ],
});

$u.ok; // true
$u.value; // [ { $id: "product:1", ... }, { $id: "product:2", ... } ]
$u.value?.nodes.get("product:1"); // { $id: "product:1", ... }
$u.value?.nodes.get("x"); // { $id: "product:1", ... }
