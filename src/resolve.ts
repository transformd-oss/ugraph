import { Result } from "esresult";
import { Graph, Node, Obj, isNode, isReference } from "./graph";

type Issue =
  | Result.Err<"NODE", { id: string; obj: Obj; path: string[] }>
  | Result.Err<"REFERENCE", { id: string; path: string[] }>;

export function resolve({
  data,
  onConflict = "abort",
}: {
  data: Readonly<Array<Obj>>;
  onConflict?: "abort" | "merge" | "ignore";
}): Result<Result.Ok<Graph>, Result.Err<"INVALID", { issues: Issue[] }>> {
  const nodes = new Map<string, Node>();
  const graph: Graph = Object.assign(new Set<Obj>(), { nodes });

  /////////////////////////////

  const issues = new Set<Issue>();
  const placeholders = new Set<Placeholder>();

  /////////////////////////////

  for (const index in data) {
    const obj = { ...data[index] }; // dereference from data
    graph.add(obj);

    const path = [index];

    if (isNode(obj)) {
      const $node = parseNode(obj, path);
      if (!$node.ok) {
        const $issue = Result.err("NODE")
          .$cause($node)
          .$info({ id: obj.$id, obj, path });
        issues.add($issue);
      }
    } else {
      parseProps(obj, path);
    }
  }

  /////////////////////////////

  function parseNode(
    node: Node,
    path: string[]
  ): Result<Node, "CONFLICT", { id: string; node: Node; path: string[] }> {
    const id = node.$id;
    const existingNode = nodes.get(id);

    if (!existingNode) {
      nodes.set(id, node);
      parseProps(node, path);
      return Result.ok(node);
    }

    if (isPlaceholder(existingNode)) {
      delete (existingNode as Node)["$placeholder"];
      Object.assign(existingNode, node);
      parseProps(existingNode, path);
    } else {
      if (onConflict === "abort") {
        return Result.err("CONFLICT").$info({ id, node, path });
      } else if (onConflict === "merge") {
        Object.assign(existingNode, node);
        parseProps(existingNode, path);
      } else if (onConflict === "ignore") {
        // ... pass
      }
    }

    return Result.ok(existingNode);
  }

  /////////////////////////////

  function parseProps(
    obj: Obj,
    path: string[]
  ): Result<undefined, "NODE", { id: string; node: Node; path: string[] }> {
    for (const key in obj) {
      if (key === "$id" || key === "$type") continue;

      const value = obj[key];
      if (!isReference(value)) continue;

      const keyPath = [...path, key];

      if (typeof value.$node === "string") {
        const nodeId = value.$node;
        const node = nodes.get(nodeId);
        if (!node) {
          const placeholder = { $placeholder: { id: nodeId, path: keyPath } };
          placeholders.add(placeholder);
          nodes.set(nodeId, placeholder as unknown as Node);
          obj[key] = placeholder;
        } else {
          obj[key] = node;
        }
      } else if (typeof value.$node === "object") {
        const $obj = parseNode(value.$node, keyPath);
        if (!$obj.ok) return Result.err("NODE").$cause($obj).$info($obj.info);
        obj[key] = $obj.value;
      } else {
        // ... pass
      }
    }

    return Result.ok(undefined);
  }

  /////////////////////////////

  placeholders.forEach((placeholder) => {
    if (isPlaceholder(placeholder)) {
      const $issue = Result.err("REFERENCE").$info(placeholder.$placeholder);
      issues.add($issue);
    }
  });

  if (issues.size)
    return Result.err("INVALID").$info({ issues: Array.from(issues.values()) });

  /////////////////////////////

  return Result.ok(graph);
}

/////////////////////////////

interface Placeholder {
  $placeholder: {
    id: string;
    path: string[];
  };
}

function isPlaceholder($: unknown): $ is Placeholder {
  if (!$) return false;
  if (!(typeof $ === "object")) return false;
  const placeholder = ($ as Placeholder).$placeholder;
  if (!(typeof placeholder === "object")) return false;
  return true;
}
