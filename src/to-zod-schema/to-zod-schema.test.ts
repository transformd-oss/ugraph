import Result from "esresult";
import { z } from "zod";
import { toZodSchema } from "./index";

////////////////////////////////////////////////////////////////////////////////

describe("string with format email flag", () => {
  const $parse = toZodSchema({
    types: {
      string: [
        toZodSchema.Type(
          z.object({ format: z.literal("email").optional() }),
          ({ format }) => {
            if (format === "email") {
              return Result(z.string().email());
            }
            return Result(undefined);
          }
        ),
      ],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const parse = $parse.value!;

  test("creates string schema using custom email format", () => {
    const $ = parse({
      schema: {
        $type: "string",
        format: "email",
      },
    }).orThrow();
    expect($.safeParse("user").success).toBeFalsy();
    expect($.safeParse("user@").success).toBeFalsy();
    expect($.safeParse("user@example.co").success).toBeTruthy();
  });

  test("creates array with string + email format", () => {
    const $ = parse({
      schema: {
        $type: "array",
        of: { $type: "string", format: "email" },
      },
    }).orThrow();
    expect($.safeParse("user").success).toBeFalsy();
    expect($.safeParse("user@example.co").success).toBeFalsy();
    expect($.safeParse(["user"]).success).toBeFalsy();
    expect($.safeParse(["user@example.co"]).success).toBeTruthy();
  });

  test("creates object with string + email format", () => {
    const $ = parse({
      schema: {
        $type: "object",
        of: {
          foo: { $type: "string", format: "email" },
          bar: { $type: "string", format: "email", required: false },
        },
      },
    }).orThrow();
    expect($.safeParse("user").success).toBeFalsy();
    expect($.safeParse({ bar: "user@example.co" }).success).toBeFalsy();
    expect($.safeParse({ foo: "user@example.co" }).success).toBeTruthy();
  });

  test("regular string", () => {
    const $ = parse({
      schema: {
        $type: "string",
      },
    }).orThrow();
    expect($.safeParse("user").success).toBeTruthy();
    expect($.safeParse("user@").success).toBeTruthy();
    expect($.safeParse("user@example.co").success).toBeTruthy();
  });
});
