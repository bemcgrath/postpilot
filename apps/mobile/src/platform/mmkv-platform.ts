import { createMMKV } from "react-native-mmkv"
import * as Crypto from "expo-crypto"
import type { Platform } from "@postpilot/core/storage/adapter"
import { MmkvStore } from "./mmkv-store"

/**
 * The one place the real native MMKV binding gets constructed. Everything
 * else -- the KeyValueStore adapter logic itself -- lives in mmkv-store.ts,
 * which has no dependency on react-native-mmkv and is unit-tested directly;
 * this file is native wiring only and isn't covered by that suite (needs a
 * real device/dev-client, per the M3 on-device verification pass).
 *
 * react-native-mmkv v4 uses Nitro Modules: instances come from createMMKV(),
 * not `new MMKV()`.
 */
export function createMobilePlatform(): Platform {
  return {
    storage: new MmkvStore(createMMKV({ id: "postpilot" })),
    randomUUID: () => Crypto.randomUUID()
  }
}
