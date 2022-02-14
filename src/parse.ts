import { Result } from "esresult";
import {
  Graph,
  Node,
  Placeholder,
  isNode,
  isPlaceholder,
  isReference,
} from "./graph";

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
