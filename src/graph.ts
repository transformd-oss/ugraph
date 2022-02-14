import { Result, Ok } from "esresult";

export function parse(
  data: Readonly<Array<Record<string, unknown>>>,
  options: { onNodeConflict?: "abort" | "merge" | "ignore" } = {}
): Result<Result.Ok<Graph, "BAD_REFERENCE">, Result.Err<"BAD_NODE">> {
  const { onNodeConflict = "abort" } = options;

  const graph: Graph = Object.assign(new Set(data), {
    nodes: new Map<string, Node>(),
  });

  /////////////////////////////

  const placeholders = new Set<Placeholder>();

  for (const obj of graph) {
    if (isNode(obj)) {
      const $obj = parseNode(obj);
      if (!$obj.ok) return Result.err("BAD_NODE").cause($obj);
    } else {
      parseProps(obj);
    }
  }

  /////////////////////////////

  function parseNode(
    node: Node
  ): Result<
    Node,
    Result.Err<
      "CONFLICT",
      { id: string; node: Record<string, unknown>; path: string[] }
    >
  > {
    const nodeId = node.$id;
    const existingNode = graph.nodes.get(nodeId);

    if (existingNode) {
      if (isPlaceholder(existingNode)) {
        delete (existingNode as Node)["$placeholder"];
        Object.assign(existingNode, node);
        parseProps(existingNode);
      } else {
        if (onNodeConflict === "abort") {
          return Result.err("CONFLICT").info({
            id: nodeId,
            node,
            path: ["..."],
          });
        } else if (onNodeConflict === "merge") {
          Object.assign(existingNode, node);
          parseProps(existingNode);
        } else if (onNodeConflict === "ignore") {
          // ... pass
        }
      }

      return Result.ok(existingNode);
    }

    graph.nodes.set(nodeId, node);
    parseProps(node);

    return Result.ok(node);
  }

  /////////////////////////////

  function parseProps(obj: Record<string, unknown>): Result<undefined> {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "$id" || key === "$type") continue;
      if (isReference(value)) {
        if (typeof value.$node === "string") {
          const nodeId = value.$node;
          const node = graph.nodes.get(nodeId);
          if (!node) {
            const placeholder = {
              $placeholder: { id: nodeId },
            };
            placeholders.add(placeholder);
            graph.nodes.set(nodeId, placeholder as unknown as Node);
            obj[key] = placeholder;
          } else {
            obj[key] = node;
          }
        } else {
          const $obj = parseNode(value.$node);
          if (!$obj.ok) return Result.err("BAD_NODE").cause($obj);
          obj[key] = $obj.value;
        }
      }
    }

    return Result.ok(undefined);
  }

  /////////////////////////////

  const errors: Result.Err<"BAD_REFERENCE", { id: string }>[] = [];

  placeholders.forEach((placeholder) => {
    if (isPlaceholder(placeholder))
      errors.push(Result.err("BAD_REFERENCE").info(placeholder.$placeholder));
  });

  /////////////////////////////

  return Result.ok(graph).warnings(errors);
}

/////////////////////////////
/////////////////////////////

export interface Graph extends Set<Record<string, unknown>> {
  nodes: Map<string, Node>;
}

/////////////////////////////

export type Node<
  TYPE extends string | undefined = string,
  PROPS extends Record<string, unknown> = Record<string, unknown>
> = {
  $id: string;
  $type: TYPE;
} & PROPS;

function isNode($: unknown): $ is Node {
  if (!$) return false;
  if (!(typeof $ === "object")) return false;
  const id = ($ as Node).$id;
  if (!(typeof id === "string")) return false;
  const type = ($ as Node).$type;
  if (!(typeof type === "string" || typeof type === "undefined")) return false;
  return true;
}

/////////////////////////////

export interface Reference {
  $node: string | Node;
}

function isReference($: unknown): $ is Reference {
  if (!$) return false;
  if (!(typeof $ === "object")) return false;
  if (
    !(
      "$node" in $ &&
      (typeof ($ as Reference).$node === "string" ||
        isNode(($ as Reference).$node))
    )
  )
    return false;
  return true;
}

/////////////////////////////

export interface Placeholder {
  $placeholder: {
    id: string;
    // path: string[];
  };
}

function isPlaceholder($: unknown): $ is Placeholder {
  if (!$) return false;
  if (!(typeof $ === "object")) return false;
  if (!("$placeholder" in $)) return false;
  return true;
}
