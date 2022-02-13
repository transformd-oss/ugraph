# μGraph

Expressive JSON format for Graph-like data/object definitions.

## Objects

Object definitions are defined as an object {} with a "$type" property:

```jsonc
{
  "$type": "Foo"
}
```

## Identified Objects (i.e. Nodes)

Object definitions can be made globally referencable by assigning an "$id".
Object definitions without an "$id" are considered anonymous.

```jsonc
{
  "$id": "Foo:qnxrs4muvb",
  "$type": "Foo",
}
```

## Node References (i.e. Edges)

Once given an "$id", the Object definition is considered a Node of a graph.
Other nodes may reference it using a "$node" reference accessor object.

```jsonc
{
  "$id": "Bar:sykvs6s4g4",
  "$type": "Bar",
  "fooProp": { "$node": "Foo:qnxrs4muvb" }
}
```

## Nesting Nodes

uGraph differentiates itself from basic JSON graph schemas by allowing for
defining Nodes within other Nodes as part of a valid uGraph schema. This is
useful when writing a tree-like graph (DAG) at first, with the flexibility of
referencing Nodes elsewhere in the `ugraph`.

Nodes may be nested within another Object/Node as still be globally referencable
by "$id". Use an Object definition for "$node" instead of an "$id" string.

> Walking this `ugraph` (as part of parsing/validation) will create a lookup map
> of all found Identified Objects (Nodes) using their contained "$id"
> properties.

```jsonc
[
  {
    "$id": "Bar:sykvs6s4g4",
    "$type": "Bar",
    "fooProp": { "$node": { "$id": "Foo:4npndimd8r", "$type": "Foo" } }
  },
  {
    "$id": "Bar:604x5kgh2v",
    "$type": "Bar",
    "fooProp": { "$node": "Foo:4npndimd8r" }
  }
]
```

## Properties on Node Relationships (i.e. Edges)

There are cases where Edges (from Object/Node to Object/Node) require additional
"edge"-props to describe contextual information about that relationship.

Depending on the definition style it can be:

1. Object definition with adjacent Edge props
1. Node definition with adjacent Edge props
1. Anonymous Node definition with adjacent Edge props
1. (Node) Reference with adjacent Edge props

```jsonc
{
  "$type": "Cat",
  "foods": [
    // (1)
    {
      "$type": "Food",
      "name": "ccc-cat-food",
      "edgeProp": "hates"
    },
    // (2)
    {
      "$node": {
        "$id": "Food:bbb-cat-food:7cacjlsr52",
        "$type": "Food",
        "name": "bbb-cat-food"
      },
      "edgeProp": "likes"
    },
    // (3)
    {
      "$node": {
        "$type": "Food",
        "name": "bbb-cat-food"
      },
      "edgeProp": "likes"
    },
    // (4)
    {
      "$node": "Food:aaa-cat-food:59sfpotqwp",
      "edgeProp": "loves"
    }
  ]
}
```

## Node Property Accessor (on Edges)

Object properties that reference Nodes may be doing so to reference a certain
property of that Node type. If you want to access a specific property of the
referenced Node you can specify a "$path" on the Node accessor for that property
to access a specific value by JSON path.

You can also target "computed" values of a targetted Node according to the Node
type's implementation, example:

1. `Webhook` Node type has `endpoint` property.
1. `Link` Node `to` property accepts a string or `Webhook` Node Reference.
1. Without "$path" meta-property the `Link` Node will infer "url" computed
  value, where the implementation provides "url" is "http://my.site/{endpoint}".
1. If desired, "$path" can be manually specified as "url".
1. Or, to provide "$path" to another value of valid property value type.

```jsonc
[
  {
    "$id": "Foo:aonh637g3c",
    "$type": "Foo",
    "prop1": "hello",
    "prop2": "world"
  },
  {
    "$id": "Bar:xqlvpfo6pw",
    "$type": "Bar",
    // relies on Bar's implementation to pull a value from given Foo object.
    "myStringProp": { "$node": "Foo:aonh637g3c" },
    // uses json-path accessor to access value from path from Foo object.
    "myStringProp": { "$node": "Foo:aonh637g3c", "$path": "$.prop1" }
  }
]
```

## Types

Supports a core set of data "types" Object definitions that can easily split out
into a Object node for reusable chunks of type definitions.

Because this core data "types" are just different types of Nodes, they can are
implementation dependent -- although it is nice to know how such concepts may
be declaratively expressed for Nodes in an uGraph.

```jsonc
// string
{ "$type": "string" }
// number
{ "$type": "number" }
// boolean
{ "$type": "boolean" }
// (string)[]
{ "$type": "array", "of": { "$type": "string" } }
// (string)[]
{ "$type": "array", "of": { "$type": "string", "minLength": 2 } }
// (string{minLength})[]
{ "$type": "array", "of": { "$node": "Type:email@v1", "minLength": 2 } }
// { foo?: string | undefined }
{ "$type": "object", "of": { "foo": { "$type": "string" } } }
// { foo: string }
{ "$type": "object", "of": { "foo": { "$type": "string", required: true } } }
// { foo?: string{minLength} | undefined }
{ "$type": "object", "of": { "foo": { "$node": "Type:email@v1" } } }
// string | number
{ "$type": "union", "of": [ { "$type": "string" }, { "$type": "number" } ] }
```

```jsonc
[
  {
    "$id": "object:Address:n4ky3lr0m0",
    "$type": "object",
    "of": { /* ... */ }
  },
  {
    "$type": "object",
    "of": {
      "address": { "$node": "object:Address:n4ky3lr0m0" }
    }
  }
]
```

You can also alias primitives to make standard types more informative, instead
of using primitives plainly.

```jsonc
[
  {
    "$id": "string:FieldTag:j50j1s1f6y",
    "$type": "string"
  },
  {
    "$type": "object",
    "of": {
      "name": { "$type": "string" },
      "fields": { "$type": "array", of: { "$node": "string:FieldTag:j50j1s1f6y" } }
    }
  }
]
```
