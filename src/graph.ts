import { z } from "zod";

/////////////////////////////

export interface Graph {
  data: unknown;
  nodes: Map<string, Node>;
}

/////////////////////////////

export type Obj = Record<string, unknown>;

export const Obj = z.object({}).passthrough();

export function isObj(source: unknown): source is Obj {
  return Obj.safeParse(source).success;
}

/////////////////////////////

export type Node<PROPS extends Obj = Obj> = { $id: string } & PROPS;

export const Node = Obj.extend({ $id: z.string() });

export function isNode(source: unknown): source is Node {
  return Node.safeParse(source).success;
}

/////////////////////////////

export type Typed<TYPE extends string = string, PROPS extends Obj = Obj> = {
  $type: TYPE;
} & PROPS;

export const Typed = Obj.extend({ $type: z.string() });

export function isTyped(source: unknown): source is Typed {
  return Typed.safeParse(source).success;
}
