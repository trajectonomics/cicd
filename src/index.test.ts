import { describe, expect, it } from "bun:test"
import { greeting } from "./index"

describe("greeting", () => {
	it("returns formatted greeting", () => {
		expect(greeting("Trajectonomics")).toBe("Hello, Trajectonomics!")
		expect(greeting()).toBe("Hello, World!")
	})
})
