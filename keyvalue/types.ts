export type KeyValueKeyPart = string | number;
export type KeyValueKey = KeyValueKeyPart[];
export interface KeyValueEntry<T> {
    key : KeyValueKey;
    value : T;
    expiresAt: number | null;
}
export type KeyValueConfig = string | { memory : true };