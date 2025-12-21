import type { JsonArray, JsonObject, JsonPrimitive, JsonValue } from "type-fest";

// Re-export JSON-safe types from type-fest for consistent usage across the app.
export type { JsonArray, JsonObject, JsonPrimitive, JsonValue };

// JSONPath node shape used when `resultType: "all"` is requested.
export type JsonPathNode = {
  path: string;
  value: JsonValue;
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
