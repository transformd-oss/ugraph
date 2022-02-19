export interface Graph {
  data: unknown;
  nodes: Map<string, Node>;
}

/////////////////////////////

export type Node<
  PROPS extends Record<string, unknown> = Record<string, unknown>
> = { $id: string } & PROPS;

export function isNode($: unknown): $ is Node {
  if (!$) return false;
  if (!(typeof $ === "object")) return false;
  const id = ($ as Node).$id;
  if (!(typeof id === "string")) return false;
  return true;
}

/////////////////////////////

export type TypedNode<
  TYPE extends string = string,
  PROPS extends Obj = Obj
> = Node<PROPS> & { $type: TYPE };

export function isTypedNode($: unknown): $ is TypedNode {
  if (!isNode($)) return false;
  const type = ($ as TypedNode).$type;
  if (!(typeof type === "string")) return false;
  return true;
}

/////////////////////////////

export type Obj = Record<string, unknown>;

/////////////////////////////

export type TypedObj<TYPE extends string = string> = Obj & {
  $type: TYPE;
};
