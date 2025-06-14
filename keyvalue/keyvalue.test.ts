import { assertEquals, assertThrows, assertFalse, assert as assertTrue } from "@std/assert";
import {  } from "@std/testing/bdd";
import { KeyValue } from "./keyvalue.ts";

const create = () => new KeyValue({ memory: true });

Deno.test("Get/Set", () => {
    using kv = create();
    const key = ["key"];
    assertEquals(kv.get(key), undefined);
    assertEquals(kv.get(key, 4), 4);
    
    assertTrue(kv.set(key, 5));
    assertEquals(kv.get(key, 4), 5);
    
    assertTrue(kv.delete(key));
    assertEquals(kv.get(key), undefined);

})