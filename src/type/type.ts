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

type TypeNode = {
  $type: "node";
  of: TypeSchema | { $node: string | TypeSchema };
  with?: TypeObject["of"];
};
export type { TypeNode as Node };

type TypeType = {
  $type: "type";
};
export type { TypeType as Type };

type TypeSchema =
  | TypeString
  | TypeNumber
  | TypeBoolean
  | TypeObject
  | TypeArray
  | TypeUnion
  | TypeRecord
  | TypeNode
  | TypeType;
export type { TypeSchema as Schema };

/**
 * Exclusively make all K members of T required, everything else is optional.
 */
type XRequired<T, K extends keyof T> = Required<Pick<T, K>> &
  Partial<Omit<T, K>>;

type FromTypeObjectOf<
  OF extends Record<string, unknown>,
  MAP extends Record<string, unknown>
> = XRequired<
  {
    [K in keyof OF]: TypeInfer<OF[K], MAP>;
  },
  {
    [K in keyof OF]-?: OF[K] extends {
      required: false;
    }
      ? never
      : K;
  }[keyof OF]
>;

type TypeInfer<
  T,
  MAP extends Record<string, unknown> = Record<string, never>
> = T extends TypeString
  ? string
  : T extends TypeNumber
  ? number
  : T extends TypeBoolean
  ? boolean
  : T extends TypeObject
  ? T["of"] extends Record<string, never>
    ? Record<string, never>
    : FromTypeObjectOf<T["of"], MAP>
  : T extends TypeArray
  ? TypeInfer<T["of"], MAP>[]
  : T extends TypeUnion
  ? TypeInfer<T["of"][number], MAP>
  : T extends TypeRecord
  ? Record<string, TypeInfer<T["of"], MAP>>
  : T extends TypeNode
  ? ("$node" extends keyof T["of"]
      ? T["of"]["$node"] extends string
        ? Get<T["of"]["$node"], MAP>
        : TypeInfer<T["of"]["$node"], MAP>
      : TypeInfer<T["of"], MAP>) &
      (T["with"] extends undefined
        ? Record<string, never>
        : FromTypeObjectOf<NonNullable<T["with"]>, MAP>)
  : T extends TypeType
  ? TypeSchema
  : never;
export type { TypeInfer as Infer };

/**
 * Get's value of key `K` from `object` O.
 */
type Get<K, O> = K extends keyof O ? O[K] : never;
