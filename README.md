# μGraph

An expressive, serialisable format for Graph-like data structures.

## Usage

- uGraph is primarily a serialisable [Format](#format).
- This repo publishes [`ugraph`](https://www.npmjs.com/package/ugraph), a parser implementation for TS/JS on NPM.

## Parser

```bash
yarn add ugraph
```

```ts
import { parse } from "ugraph";

const data = [
  { $id: "abc" },
  { $id: "foo", prop: { $node: "bar" } },
  { $id: "bar", prop: { $node: "foo" } },
];

const $graph = parse({ data });

// handle errors
if ($graph.error) ...

// use valid graph
const graph = $graph.value

// parses consistent object references
>>> foo = graph.nodes.get("foo")
>>> bar = graph.nodes.get("bar")

>>> foo.prop === bar
// true
>>> bar.prop === foo
// true
```

### With Types

- [`example.ts`](example.ts)

## Format

### `Node`

`{ $id: string }`

- Nodes are Objects with a unique Identifier (`"$id"`) property.

```jsonc
{
  "$id": "foo"
}
```

### `Reference` (i.e. Edges)

`{ $node: string }`

- All Nodes may be referenced by it's Identifier using a Reference expression.

```jsonc
{
  "property": { "$node": "bar" }
}
```

#### Reference with Inline Node

`{ $node: Node }`

- References may also inline the definition the Node it is referencing.
- This is useful if you are working with mainly tree-like, acyclical graphs.

```jsonc
{
  "property": { "$node": { "$id": "bar", /* ... */ } }
}
```

#### Reference with Properties

`{ $node: string | Node, [key]: any }`

- References may also define contextual properties about the relationship.

```jsonc
{
  "friends": [
    {
      // reference
      "$node": "personA",
      // properties
      "friendsSince": "2022-01-01T00:00:00.0Z",
      "friendsUntil": "2023-02-02T00:00:00.0Z"
    }
  ],
  // ...
  "users": [
    // node
    { "$id": "personA" }
  ]
}
```

#### Reference with References to Nodes

`{ $node: string | Node, [key]: Reference }`

- References to Nodes can have contextual properties that also reference other
  Nodes, forming [hyperedges](https://en.wikipedia.org/wiki/Hypergraph).

```jsonc
{
  "favourites": [
    {
      // reference (1)
      "$node": "note:j78arsmqw4",
      "addedAt": "2022-01-01T00:00:00.0Z",
      "addedBy": {
        // reference (2)
        "$node": "user:vl1vh2i22i"
      }
    }
  ],
  // ...
  "notes": [
    // node (1)
    { "$id": "note:j78arsmqw4" }
  ],
  "users": [
    // node (2)
    { "$id": "user:vl1vh2i22i" }
  ]
}
```

### `Accessors` (i.e. References to Node Properties)

`{ $node: string | Node, $path: string }`

- References may be used to access specific values on a referenced Node using a
  Accessor expression.
- The property access `"$path"` uses [JSON Path](https://jsonpath.com/) format.

```jsonc
[
  {
    "$id": "aaa",
    "name": "foo"
  },
  {
    "$id": "bbb",
    "name": { "$node": "aaa", "$path": "$.name" }
  }
]
```

#### References to Computed Node Properties (i.e. Dynamic Accessors)

- If supported by the parser, Nodes can define their own runtime interfaces for
  supporting "computed" properties that can be resolved when targetted by
  `$path`.

```jsonc
[
  {
    "$id": "aaa",
    "endpoint": "hello",
  },
  {
    "$id": "bbb",
    // "url" computed property on runtime interface
    // -> e.g. Webhook.url() => "https://mysite.com/webhooks/hello"
    "url": { "$node": "aaa", "$path": "$.url" }
  }
]
```
