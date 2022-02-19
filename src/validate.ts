import { Result } from "esresult";
import { Node, TypedNode, isTypedNode } from "./graph";
import { toTypeSchema } from "./to-type-schema";

type Issue = { id: string; node: Node; issue: NodeIssue };
type NodeIssue = { path: string[]; message: unknown; info?: unknown };

type NodeErrors = Result.Err<"NODE", { id: string; node: Node }>;
type TypeErrors = Result.Err<"TYPE", { id: string; type: Node }>;

export function validate({
  nodes,
  types,
}: {
  nodes: Map<string, Node>;
  types: Map<string, TypedNode>;
}): Result<
  Result.Ok<{ valid: true } | { valid: false; issues: Issue[] }>,
  | Result.Err<"TYPES", { errors: TypeErrors[] }>
  | Result.Err<"NODES", { errors: NodeErrors[] }>
> {
  const issues = new Set<Issue>();
  const typeValidators = new Map<string, (node: Node) => NodeIssue[]>();

  /////////////////////////////

  const typeErrors = new Set<TypeErrors>();

  for (const [id, type] of types) {
    const $validator = toTypeValidator(type);
    if (!$validator.ok) {
      typeErrors.add(Result.err("TYPE").$cause($validator).$info({ id, type }));
    } else {
      typeValidators.set(id, $validator.value);
    }
  }

  if (typeErrors.size)
    return Result.err("TYPES").$info({ errors: Array.from(typeErrors) });

  /////////////////////////////

  const nodeErrors = new Set<NodeErrors>();

  for (const [id, node] of nodes) {
    if (!isTypedNode(node)) continue;
    const $valid = validateNode(node);
    if (!$valid.ok) {
      nodeErrors.add(Result.err("NODE").$cause($valid).$info({ id, node }));
    } else if (!$valid.value.valid) {
      $valid.value.issues.forEach((issue) => {
        issues.add({ id, node, issue });
      });
    }
  }

  if (nodeErrors.size)
    return Result.err("NODES").$info({ errors: Array.from(nodeErrors) });

  /////////////////////////////

  function validateNode(
    node: TypedNode
  ): Result<
    { valid: true } | { valid: false; issues: NodeIssue[] },
    Result.Err<"$$$", { id: string; node: Record<string, unknown> }>
  > {
    const type = node.$type;
    const validator = typeValidators.get(type);
    if (!validator)
      return Result.ok({
        valid: false,
        issues: [{ path: ["$type"], message: `invalid type "${type}"` }],
      });

    const issues = validator(node);
    if (issues.length)
      return Result.ok({
        valid: false,
        issues,
      });

    return Result.ok({ valid: true });
  }

  /////////////////////////////

  if (issues.size)
    return Result.ok({ valid: false, issues: Array.from(issues) });

  /////////////////////////////

  return Result.ok({ valid: true });
}

/////////////////////////////

function toTypeValidator(node: TypedNode): Result<(node: Node) => NodeIssue[]> {
  const $schema = toTypeSchema(node);
  if (!$schema.ok) return Result.err("SCHEMA").$cause($schema).$info({ node });

  const schema = $schema.value;

  function validator(node: Node): NodeIssue[] {
    const $parse = schema.safeParse(node);
    if ($parse.success) return [];

    return $parse.error.issues.map((issue) => ({
      path: issue.path.map((v) => v.toString()),
      message: issue.message,
      info: issue,
    }));
  }

  return Result.ok(validator);
}
