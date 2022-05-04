import "esresult/global";
import { z } from "zod";
import { parse } from "./parse";
import { parseCyclical } from "./parse-cyclical";

it("should give me a correct validated node from id", () => {
  interface User {
    name: string;
    friend?: User;
  }

  const User: z.ZodType<User> = z.lazy(() =>
    z.object({
      name: z.string(),
      friend: User.optional(),
    })
  );

  const graph = parse([
    {
      $id: "a",
      name: "aaa",
      friend: { $node: "b" },
    },
    {
      $id: "b",
      name: "bbb",
      friend: { $node: "a" },
    },
  ]).orThrow();

  const $ = parseCyclical(graph.nodes.get("a"), User);

  const [user] = $;

  expect(user).toMatchObject({
    name: "aaa",
    friend: {
      name: "bbb",
      friend: {
        name: "aaa",
        friend: {},
      },
    },
  });
});
