export type Obj = Record<string, unknown>;

/////////////////////////////

export interface Graph {
  data: unknown;
  nodes: Map<string, Node>;
}

/////////////////////////////

export type Node<
  PROPS extends Record<string, unknown> = Record<string, unknown>
> = { $id: string } & PROPS;

/////////////////////////////

export type TypedNode<
  TYPE extends string = string,
  PROPS extends Record<string, unknown> = Record<string, unknown>
> = Node<PROPS> & { $type: TYPE };

/////////////////////////////

export type Instance<
  TYPE extends string | undefined = string,
  PROPS extends Record<string, unknown> = Record<string, unknown>
> = {
  $id?: string;
  $type: TYPE;
} & PROPS;
