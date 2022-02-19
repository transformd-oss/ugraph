export type Obj = Record<string, unknown>;

/////////////////////////////

export interface Graph extends Set<Obj> {
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

export function isNode($: unknown): $ is Node {
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
