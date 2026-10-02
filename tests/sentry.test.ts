import { describe, it, expect } from "vitest";
import {
  isSentryEnabled,
  captureException,
  setSentryUser,
  clearSentryUser,
} from "../src/config/sentry";

describe("sentry", () => {
  it("isSentryEnabled est un boolean", () => {
    expect(typeof isSentryEnabled).toBe("boolean");
  });

  it("captureException ne crash pas sans DSN", () => {
    expect(() => {
      captureException(new Error("test"), { context: "test" });
    }).not.toThrow();
  });

  it("setSentryUser ne crash pas sans DSN", () => {
    expect(() => {
      setSentryUser({ id: 1, email: "a@b.com" });
    }).not.toThrow();
  });

  it("clearSentryUser ne crash pas sans DSN", () => {
    expect(() => {
      clearSentryUser();
    }).not.toThrow();
  });
});