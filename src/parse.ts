import { Result } from "esresult";
import type { Graph } from "./graph";
import { resolve } from "./resolve";
import { validate } from "./validate";

export function parse({
  data,
  types,
}: {
  data: unknown;
  types?: unknown;
}): Result<Graph, "RESOLVE" | "VALIDATE" | "TYPES"> {
  const $graph = resolve({ data });
  if (!$graph.ok) return Result.err("RESOLVE").$cause($graph);

  const graph = $graph.value;
  const { nodes } = graph;

  if (types) {
    const $typesGraph = resolve({ data: types });
    if (!$typesGraph.ok) return Result.err("TYPES").$cause($typesGraph);

    const typesGraph = $typesGraph.value;

    const $valid = validate({ nodes, types: typesGraph.nodes });
    if (!$valid.ok) return Result.err("VALIDATE").$cause($valid);
  }

  return Result.ok(graph);
}
