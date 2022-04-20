import Result from "esresult";
import { z, ZodTypeAny } from "zod";
import { Graph, Obj, Node, Typed, isObj, isNode, isTyped } from "../graph";
import { toTypeSchema, typeDefinitions } from "../to-type-schema";

/////////////////////////////

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
export function parse(options: {
  /**
   * Data to walk and extract nodes from.
   */
  data: unknown;
  /**
   * Type definitions to enforce node schemas via $type declarations.
   * - if given Map<NodeID, TypedNode> will create validators automatically.
   * - if given Map<TypeName, Validator> will use as is.
   * - otherwise, will be parsed via `resolve` automatically for validators.
   */
  types?: unknown;
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
  /**
   * Optional callback fired once per-every complete Typed object, with $type.
   */
  onTyped?: (type: string, typed: Typed) => void;
}): Result<
  Graph,
  | ["DATA_INVALID", { errors: DataError[] }]
  | ["TYPES_INVALID", { errors: TypesError[] }]
> {
  const { types } = options;
  const $typeValidators = resolveTypeValidators(types);
  if ($typeValidators.error)
    return Result.error(["TYPES_INVALID", $typeValidators.error.meta], {
      cause: $typeValidators,
    });

  const typeValidators = $typeValidators.value;

  type NodeId = string;
  const nodes = new Map<NodeId, Node>();
  const typeds = new Map<Typed, { paths: string[][] }>();
  const pendings = new Map<Pending, { paths: string[][] }>();
  const errors = new Set<DataError>();

  /////////////////////////////

  const { onConflict = "abort" } = options;

  /**
   * Return recursively resolved values from Obj/Node/Reference definitions.
   */
  function walk(source: unknown, path: string[] = []): unknown {
    if (isNode(source)) {
      let node = source;

      const id = node.$id;
      const existingNode = nodes.get(id);

      if (!existingNode) {
        node = { ...node };
        nodes.set(id, node);

        walkObj(node, path);
        if (isTyped(node)) addPath(typeds, node, path);
        return node;
      }

      if (isPending(existingNode)) {
        delete (existingNode as Node)["$pending"];
        pendings.delete(existingNode);

        Object.assign(existingNode, node);
        node = existingNode;

        walkObj(node, path);
        if (isTyped(node)) addPath(typeds, node, path);
        return node;
      }

      if (onConflict === "abort") {
        errors.add(Result.error(["NODE_CONFLICT", { path, node }]));
      } else if (onConflict === "merge") {
        Object.assign(existingNode, node);
        node = existingNode;

        walkObj(node, path);
        if (isTyped(node)) addPath(typeds, node, path);
        return node;
      }
    }

    if (isReference(source)) {
      const reference = source;

      let obj: Obj = {};

      const { $node, ...edgeProps } = reference;
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

      return new Proxy({ $node: obj, ...edgeProps } as Obj, {
        get(target, key) {
          if (typeof key !== "string") return;
          return target[key] ?? obj[key];
        },
        getOwnPropertyDescriptor(target, key) {
          if (typeof key !== "string") return;
          const enumerable = !!(
            Object.getOwnPropertyDescriptor(target, key) ||
            Object.getOwnPropertyDescriptor(obj, key)
          );
          const value = target[key] ?? obj[key];
          return { configurable: true, enumerable, value };
        },
        ownKeys(target) {
          return Object.keys(target).concat(Object.keys(obj));
        },
      });
    }

    if (isObj(source)) {
      const obj = { ...source };

      walkObj(obj, path);
      if (isTyped(obj)) addPath(typeds, obj, path);

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
  function walkObj(obj: Obj, path: string[] = []): void {
    for (const key in obj) {
      const value = obj[key];
      obj[key] = walk(value, [...path, key]);
    }
  }

  /**
   * Parse and validate given Typed object.
   */
  function parseTyped(typed: Typed, paths: string[][]): boolean {
    const type = typed.$type;
    const validator = typeValidators.get(type);
    if (!validator) {
      paths.forEach((path) =>
        errors.add(Result.error(["TYPED_INVALID_TYPE", { path, typed, type }]))
      );
      return false;
    }

    const issues = validator(typed);
    if (issues.length) {
      paths.forEach((path) =>
        errors.add(
          Result.error(["TYPED_INVALID_PROPS", { path, typed, issues }])
        )
      );
      return false;
    }

    return true;
  }

  /**
   * Parse given Pending object reference, reporting all unresolved references.
   */
  function parsePending(pending: Pending, paths: string[][]): void {
    paths.forEach((path) =>
      errors.add(
        Result.error(["NODE_INVALID_REFERENCE", { path, id: pending.$id }])
      )
    );
  }

  /////////////////////////////
  const { data } = options;
  const graph: Graph = { data: walk(data), nodes };

  const { onNode } = options;
  if (onNode) {
    nodes.forEach((node, id) => onNode(id, node));
  }

  pendings.forEach(({ paths }, pending) => parsePending(pending, paths));

  const { onTyped } = options;
  typeds.forEach(({ paths }, typed) => {
    if (types) {
      parseTyped(typed, paths);
    }
    if (onTyped) {
      onTyped(typed.$type, typed);
    }
  });

  if (errors.size) {
    return Result.error([
      "DATA_INVALID",
      {
        errors: Array.from(errors.values()),
      },
    ]);
  }

  return Result(graph);
}

/////////////////////////////

type DataError = Result.Error<
  | ["OBJ_INVALID", { path: string[]; obj: Obj }]
  | ["NODE_CONFLICT", { path: string[]; node: Node }]
  | ["NODE_INVALID_REFERENCE", { path: string[]; id: string }]
  | ["TYPED_INVALID_TYPE", { path: string[]; typed: Typed; type: string }]
  | [
      "TYPED_INVALID_PROPS",
      { path: string[]; typed: Typed; issues: TypedError[] }
    ]
>;

/////////////////////////////

type Reference = z.infer<typeof Reference>;

const Reference = Obj.extend({
  $node: z.union([z.string(), Obj]),
});

export function isReference(source: unknown): source is Reference {
  return Reference.safeParse(source).success;
}

/////////////////////////////

type Pending = z.infer<typeof Pending>;

const Pending = Obj.extend({
  $id: z.string(),
  $pending: z.literal(true),
});

function isPending(source: unknown): source is Pending {
  return Pending.safeParse(source).success;
}

/////////////////////////////

type TypedError = { path: string[]; message: unknown; info?: unknown };

interface TypeValidator {
  (typed: Typed): TypedError[];
}

export type TypesError = Result.Error<
  | "RESOLVE"
  | ["INVALID_TYPED", { id: string; type: unknown }]
  | ["INVALID_PROPS", { id: string; type: Typed }]
>;

const defaultTypeValidators = new Map<string, TypeValidator>(
  Object.entries(typeDefinitions).map(([name, typeType]) => [
    name,
    createTypeValidator(typeType.schema),
  ])
);

export function resolveTypeValidators(
  types: unknown
): Result<
  Map<string, TypeValidator>,
  ["TYPES_INVALID", { errors: TypesError[] }]
> {
  const typeValidators = new Map<string, TypeValidator>(defaultTypeValidators);

  if (types) {
    type Type = Node & Typed;
    const typesNodes = new Map<string, Type>();
    const typesErrors = new Set<TypesError>();

    if (types instanceof Map) {
      for (const [id, type] of types) {
        if (typeof type === "function") {
          typeValidators.set(id, type);
        } else if (isNode(type) && isTyped(type)) {
          typesNodes.set(id, type);
        } else {
          typesErrors.add(Result.error(["INVALID_TYPED", { id, type }]));
        }
      }
    } else {
      const $typesGraph = parse({ data: types });
      if ($typesGraph.error) {
        typesErrors.add(Result.error("RESOLVE"));
      } else {
        $typesGraph.value.nodes.forEach((type, id) => {
          if (isTyped(type)) {
            typesNodes.set(id, type);
          } else {
            typesErrors.add(Result.error(["INVALID_TYPED", { id, type }]));
          }
        });
      }
    }

    for (const [id, type] of typesNodes) {
      const $schema = toTypeSchema(type);
      if ($schema.error) {
        typesErrors.add(
          Result.error(["INVALID_PROPS", { id, type }], { cause: $schema })
        );
        continue;
      }
      const schema = $schema.value;
      const typeValidator = createTypeValidator(schema);

      typeValidators.set(id, typeValidator);
    }

    if (typesErrors.size)
      return Result.error([
        "TYPES_INVALID",
        { errors: Array.from(typesErrors) },
      ]);
  }

  return Result(typeValidators);
}

function createTypeValidator(schema: ZodTypeAny): TypeValidator {
  return (type) => {
    const $parse = schema.safeParse(type);
    if ($parse.success) return [];

    return $parse.error.issues.map((issue) => ({
      path: issue.path.map((v) => v.toString()),
      message: issue.message,
      info: issue,
    }));
  };
}

/////////////////////////////

function addPath<T extends Map<unknown, { paths: string[][] }>>(
  map: T,
  key: T extends Map<infer U, unknown> ? U : never,
  path: string[]
): void {
  const value = map.get(key);
  if (value) value.paths.push(path);
  map.set(key, { paths: [path] });
}
