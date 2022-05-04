import { z } from "zod";

export type Obj = Record<string, unknown>;
export const Obj = z.object({}).passthrough();
export function isObj(source: unknown): source is Obj {
  return Obj.safeParse(source).success;
}

export type Node<PROPS extends Obj = Obj> = { $id: string } & PROPS;
export const Node = Obj.extend({ $id: z.string() });
export function isNode(source: unknown): source is Node {
  return Node.safeParse(source).success;
}

type Reference = z.infer<typeof Reference>;
const Reference = Obj.extend({
  $node: z.union([z.string(), Obj]),
});
export function isReference(source: unknown): source is Reference {
  return Reference.safeParse(source).success;
}

type Pending = z.infer<typeof Pending>;
const Pending = Obj.extend({
  $id: z.string(),
  $pending: z.literal(true),
});
function isPending(source: unknown): source is Pending {
  return Pending.safeParse(source).success;
}

type Path = string[];
type DataError = Result.Error<
  | ["NodeIdConflict", { path: Path; id: string; conflictPath: Path }]
  | ["NodeReferenceBroken", { path: Path; id: string }]
>;

/**
 * Given `data`, will return a runtime Graph with all Nodes recursively
 * resolved and mapped in `.nodes` for access via. that Node's `$id`. Accepts
 * any data structure, although Objects and/or Arrays are most useful.
 *
 * If given `types`, will also validate all Objects with a `$type` property
 * defined. Accepts a Map of Nodes and/or Validators OR a `data`-like definition
 * which will be automatically parsed for it's Nodes. Type-definition Nodes use
 * it's `$id` property to determine which `$type` name to validate on a Object.
 */
export function parse(
  data: unknown,
  options: {
    /**
     * Default: "abort"
     * - "abort", return error on conflicting node definition.
     * - "merge", merge props of all conflicting node definitions (slower).
     * - "ignore", skips conflicts (only first instance is used).
     */
    onConflict?: "abort" | "merge" | "ignore";
    /**
     * Optional callback fired once per-every complete Node object, with $id.
     */
    onNode?: (id: string, node: Node) => void;
  } = {}
): Result<
  { data: unknown; nodes: Map<string, Node> },
  ["DataInvalid", { errors: DataError[] }]
> {
  type NodeId = string;
  const nodes = new Map<NodeId, Node>();
  const nodePathsMap = new Map<Node, Path[]>();
  const pendings = new Map<Pending, { paths: Path[] }>();
  const errors = new Set<DataError>();

  const { onConflict = "abort" } = options;

  /**
   * Return recursively resolved values from Obj/Node/Reference definitions.
   */
  function walk(source: unknown, path: Path = []): unknown {
    if (isNode(source)) {
      let node = source;

      const id = node.$id;
      const existingNode = nodes.get(id);

      if (!existingNode) {
        // this is the first occurance of this node's definition

        node = { ...node };
        nodes.set(id, node);

        const nodePaths = nodePathsMap.get(node) ?? [];
        nodePathsMap.set(node, [...nodePaths, path]);

        walkObj(node, path);
        return node;
      }

      if (isPending(existingNode)) {
        // the existing node was just a pending placeholder

        delete (existingNode as Node)["$pending"];
        pendings.delete(existingNode);

        Object.assign(existingNode, node);
        node = existingNode;

        const nodePaths = nodePathsMap.get(node) ?? [];
        nodePathsMap.set(node, [...nodePaths, path]);

        walkObj(node, path);
        return node;
      }

      // now conflicting, duplicate definition
      if (onConflict === "abort") {
        const nodePaths = nodePathsMap.get(existingNode);
        if (!nodePaths) {
          throw new TypeError("node is supposed to have node paths.");
        }

        const conflictPath = nodePaths[0];
        if (!conflictPath) {
          throw new TypeError("node is supposed to have at least 1 path");
        }

        errors.add(
          Result.error([
            "NodeIdConflict",
            {
              path,
              id: node.$id,
              conflictPath,
            },
          ])
        );
      } else if (onConflict === "merge") {
        Object.assign(existingNode, node);
        node = existingNode;

        const nodePaths = nodePathsMap.get(node) ?? [];
        nodePathsMap.set(node, [...nodePaths, path]);

        walkObj(node, path);
        return node;
      }
    }

    if (isReference(source)) {
      const reference = source;

      let obj: Obj = {};

      const { $node } = reference;
      if (typeof $node === "string") {
        const id = $node;

        let node = nodes.get(id);
        if (node) {
          if (isPending(node)) addPath(pendings, node, path);
        } else {
          node = { $id: id, $pending: true };
          addPath(pendings, node as Pending, path);
          nodes.set(id, node as Node);
        }

        obj = node;
      } else {
        obj = walk($node, path) as Node;
      }

      return obj;
    }

    if (isObj(source)) {
      const obj = { ...source };
      walkObj(obj, path);
      return obj;
    }

    if (Array.isArray(source)) {
      return source.map((value, index) => walk(value, [...path, `${index}`]));
    }

    return source;
  }

  /**
   * Walk all properties of object.
   */
  function walkObj(obj: Obj, path: Path = []): void {
    for (const key in obj) {
      const value = obj[key];
      obj[key] = walk(value, [...path, key]);
    }
  }

  /**
   * Parse given Pending object reference, reporting all unresolved references.
   */
  function parsePending(pending: Pending, paths: Path[]): void {
    paths.forEach((path) =>
      errors.add(
        Result.error([
          "NodeReferenceBroken",
          {
            path,
            id: pending.$id,
          },
        ])
      )
    );
  }

  const dataOutput = walk(data);

  const { onNode } = options;
  if (onNode) {
    nodes.forEach((node, id) => onNode(id, node));
  }

  pendings.forEach(({ paths }, pending) => parsePending(pending, paths));

  if (errors.size) {
    return Result.error([
      "DataInvalid",
      {
        errors: Array.from(errors.values()),
      },
    ]);
  }

  return Result({ data: dataOutput, nodes });
}

/////////////////////////////

function addPath<T extends Map<unknown, { paths: Path[] }>>(
  map: T,
  key: T extends Map<infer U, unknown> ? U : never,
  path: Path
): void {
  const value = map.get(key);
  if (value) value.paths.push(path);
  map.set(key, { paths: [path] });
}
