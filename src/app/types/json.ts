// JSON-safe value types (the four aliases type-fest used to supply).
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

// JSONPath node shape used when `resultType: "all"` is requested.
export type JsonPathNode = {
  path: string;
  value: JsonValue;
  parent: Record<string, JsonValue>;
  parentProperty: string;
};

// Mapping configuration used in UI (includes a stable id).
export type KeyMapping = { inputKey: string; outputKey: string; id: number };

// Resolved mapping with located input/output nodes.
// This represents a specific mapping row that has been resolved to concrete JSONPath nodes.
// Keeping `id` allows callers (and logs/UI) to trace results back to the originating mapping.
export type ValidMapping = KeyMapping & {
  inputNodes: JsonPathNode[];
  outputNodes: JsonPathNode[];
};
