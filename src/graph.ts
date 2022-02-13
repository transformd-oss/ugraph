export type Node<
  TYPE extends string = string,
  PROPS extends Record<string, unknown> = Record<string, unknown>
> = {
  $id: string;
  $type: TYPE;
} & PROPS;

export interface Graph extends Set<object> {
  nodes: Set<Node>;
}

export function parse(data: Readonly<Array<object>>): Graph {
  const graph: Graph = Object.assign(new Set(data), { nodes: new Set<Node>() });
  return graph;
}
