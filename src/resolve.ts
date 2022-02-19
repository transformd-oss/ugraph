import { Result } from "esresult";
import { Graph, Node, Obj } from "./graph";

type Error =
  | Result.Err<"NODE", { id: string; obj: Obj; path: string[] }>
  | Result.Err<"CONFLICT", { path: string[]; node: Node }>
  | Result.Err<"REFERENCE", { id: string; path: string[] }>;

/**
 * Given `data` array of Objects/Nodes, will resolve a runtime Graph with all
 * References recursively resolved and `.nodes` flattened for access via. `$id`.
 */
export function resolve({
  data,
  onConflict = "abort",
}: {
  data: unknown;
  onConflict?: "abort" | "merge" | "ignore";
}): Result<Result.Ok<Graph>, Result.Err<"INVALID", { errors: Error[] }>> {
  const nodes = new Map<string, Node>();
  const errors = new Set<Error>();
  const placeholders = new Set<Placeholder>();
  const graph: Graph = { data: walk(data), nodes };

  /////////////////////////////

  function walkObj(source: Obj, path: string[] = []): Obj {
    const obj: Obj = {};
    for (const key in source) {
      const value = source[key];
      obj[key] = walk(value, [...path, key]);
    }
    return obj;
  }

  function walk(source: unknown, path: string[] = []): unknown {
    if (isNode(source)) {
      const node = source;

      const id = node.$id;
      const existingNode = nodes.get(id);

      if (existingNode) {
        if (isPlaceholder(existingNode)) {
          delete (existingNode as Node)["$placeholder"];
          Object.assign(existingNode, walkObj(node, path));
        } else {
          if (onConflict === "abort") {
            errors.add(Result.err("CONFLICT").$info({ path, node }));
          } else if (onConflict === "merge") {
            Object.assign(existingNode, walkObj(node, path));
          }
        }
        return existingNode;
      } else {
        const newNode = walkObj(node, path) as Node;
        nodes.set(id, newNode);
        return newNode;
      }
    }

    if (isReference(source)) {
      const { $node } = source;

      if (typeof $node === "string") {
        const id = $node;
        const node = nodes.get(id);
        if (node) return node;

        const placeholder = { $placeholder: { id, path } };
        placeholders.add(placeholder);
        nodes.set(id, placeholder as unknown as Node);
        return placeholder;
      }

      return walk($node, path);
    }

    if (Array.isArray(source)) {
      return source.map((value, index) => walk(value, [...path, `${index}`]));
    }

    if (source && typeof source === "object") {
      return walkObj(source as Obj, path);
    }

    return source;
  }

  /////////////////////////////

  placeholders.forEach((placeholder) => {
    if (isPlaceholder(placeholder)) {
      const $error = Result.err("REFERENCE").$info(placeholder.$placeholder);
      errors.add($error);
    }
  });

  if (errors.size)
    return Result.err("INVALID").$info({ errors: Array.from(errors.values()) });

  /////////////////////////////

  return Result.ok(graph);
}

/////////////////////////////

export interface Reference {
  $node: string | Node;
}

interface Placeholder {
  $placeholder: {
    id: string;
    path: string[];
  };
}

/////////////////////////////

export function isNode($: unknown): $ is Node {
  if (!$) return false;
  if (!(typeof $ === "object")) return false;
  const id = ($ as Node).$id;
  if (!(typeof id === "string")) return false;
  return true;
}

export function isReference($: unknown): $ is Reference {
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

function isPlaceholder($: unknown): $ is Placeholder {
  if (!$) return false;
  if (!(typeof $ === "object")) return false;
  const placeholder = ($ as Placeholder).$placeholder;
  if (!(typeof placeholder === "object")) return false;
  return true;
}
