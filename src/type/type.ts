export type Empty = Record<string, never>;
export const Empty = {} as Empty;

type TypeString = { $type: "string" };
export type { TypeString as String };

type TypeNumber = { $type: "number" };
export type { TypeNumber as Number };

type TypeBoolean = { $type: "boolean" };
export type { TypeBoolean as Boolean };

type TypeObject = {
  $type: "object";
  of: Record<string, TypeSchema & { required?: boolean }>;
};
export type { TypeObject as Object };

type TypeArray = { $type: "array"; of: TypeSchema };
export type { TypeArray as Array };

type TypeUnion = { $type: "union"; of: Readonly<TypeSchema[]> };
export type { TypeUnion as Union };

type TypeRecord = { $type: "record"; of: TypeSchema };
export type { TypeRecord as Record };

type TypeSchema =
  | TypeString
  | TypeNumber
  | TypeBoolean
  | TypeObject
  | TypeArray
  | TypeUnion
  | TypeRecord;
export type { TypeSchema as Schema };

/**
 * Exclusively make all K members of T required, everything else is optional.
 */
type XRequired<T, K extends keyof T> = Required<Pick<T, K>> &
  Partial<Omit<T, K>>;

type TypeInfer<T> = T extends TypeString
  ? string
  : T extends TypeNumber
  ? number
  : T extends TypeBoolean
  ? boolean
  : T extends TypeObject
  ? T["of"] extends Record<string, never>
    ? Record<string, never>
    : XRequired<
        {
          [K in keyof T["of"]]: TypeInfer<T["of"][K]>;
        },
        {
          [K in keyof T["of"]]-?: T["of"][K] extends {
            required: false;
          }
            ? never
            : K;
        }[keyof T["of"]]
      >
  : T extends TypeArray
  ? TypeInfer<T["of"]>[]
  : T extends TypeUnion
  ? TypeInfer<T["of"][number]>
  : T extends TypeRecord
  ? Record<string, TypeInfer<T["of"]>>
  : never;
export type { TypeInfer as Infer };
