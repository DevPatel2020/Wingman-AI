import { describe, expect, it } from "vitest"
import { isLikelyHallucination } from "../electron/TranscriptionService"

describe("isLikelyHallucination", () => {
  it.each(["Thank you.", "[BLANK_AUDIO]", "(music)", "...", "you", "Thanks for watching!", "  "])(
    "filters %j",
    (text) => expect(isLikelyHallucination(text)).toBe(true)
  )

  it.each(["Thank you for joining, let's start with the roadmap.", "We should ship the API by Friday."])(
    "keeps real speech %j",
    (text) => expect(isLikelyHallucination(text)).toBe(false)
  )
})
