import assert from "node:assert/strict";
import { inspect } from "node:util";

/**
 * A tiny `expect`-style facade over `node:assert`, so the suite reads like
 * Vitest while running on `node:test` with **no test-runner dependency**. Only
 * the matchers the codebase actually uses are implemented.
 */

const show = (value: unknown): string =>
  typeof value === "string" ? JSON.stringify(value) : inspect(value, { depth: 3 });

function deepEqual(a: unknown, b: unknown): boolean {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

class ArrayContaining {
  constructor(readonly items: readonly unknown[]) {}
}

/* eslint-disable @typescript-eslint/no-explicit-any */
class Assertion {
  constructor(private readonly actual: any, private readonly negated = false) {}

  get not(): Assertion {
    return new Assertion(this.actual, !this.negated);
  }

  private check(pass: boolean, message: string): void {
    if (this.negated ? pass : !pass) {
      assert.fail(`expected ${show(this.actual)} ${this.negated ? "not " : ""}${message}`);
    }
  }

  toBe(expected: unknown): void {
    this.check(Object.is(this.actual, expected), `to be ${show(expected)}`);
  }
  toEqual(expected: unknown): void {
    if (expected instanceof ArrayContaining) {
      const pass =
        Array.isArray(this.actual) &&
        expected.items.every((item) => this.actual.some((a: unknown) => deepEqual(a, item)));
      this.check(pass, `to contain ${show(expected.items)}`);
      return;
    }
    this.check(deepEqual(this.actual, expected), `to equal ${show(expected)}`);
  }
  toContain(sub: unknown): void {
    const pass =
      typeof this.actual === "string"
        ? this.actual.includes(sub as string)
        : Array.isArray(this.actual)
          ? this.actual.some((a: unknown) => deepEqual(a, sub))
          : false;
    this.check(pass, `to contain ${show(sub)}`);
  }
  toMatch(expected: RegExp | string): void {
    const pass =
      typeof expected === "string" ? String(this.actual).includes(expected) : expected.test(String(this.actual));
    this.check(pass, `to match ${expected}`);
  }
  toThrow(expected?: ErrorMatcher): void {
    let threw = false;
    let error: unknown;
    try {
      (this.actual as () => void)();
    } catch (caught) {
      threw = true;
      error = caught;
    }
    this.check(threw && (expected === undefined || matchError(error, expected)), `to throw ${String(expected ?? "")}`);
  }
  toBeNull(): void {
    this.check(this.actual === null, "to be null");
  }
  toBeUndefined(): void {
    this.check(this.actual === undefined, "to be undefined");
  }
  toBeDefined(): void {
    this.check(this.actual !== undefined, "to be defined");
  }
  toBeTruthy(): void {
    this.check(Boolean(this.actual), "to be truthy");
  }
  toBeFalsy(): void {
    this.check(!this.actual, "to be falsy");
  }
  toBeGreaterThan(n: number): void {
    this.check(this.actual > n, `to be greater than ${n}`);
  }
  toBeGreaterThanOrEqual(n: number): void {
    this.check(this.actual >= n, `to be >= ${n}`);
  }
  toBeLessThan(n: number): void {
    this.check(this.actual < n, `to be less than ${n}`);
  }
  toHaveLength(n: number): void {
    this.check(this.actual?.length === n, `to have length ${n}`);
  }
  toBeInstanceOf(ctor: abstract new (...args: any[]) => unknown): void {
    this.check(this.actual instanceof ctor, `to be an instance of ${ctor.name}`);
  }
  toMatchObject(expected: Record<string, unknown>): void {
    this.check(matchObject(this.actual, expected), `to match object ${show(expected)}`);
  }
  toHaveBeenCalled(): void {
    this.check((this.actual?.mock?.calls?.length ?? 0) > 0, "to have been called");
  }
  toHaveBeenCalledWith(...args: unknown[]): void {
    const calls: unknown[][] = this.actual?.mock?.calls ?? [];
    this.check(calls.some((call) => deepEqual(call, args)), `to have been called with ${show(args)}`);
  }

  get rejects(): AsyncAssertion {
    return new AsyncAssertion(this.actual, this.negated);
  }
}

class AsyncAssertion {
  constructor(private readonly value: any, private readonly negated: boolean) {}
  private promise(): Promise<unknown> {
    return typeof this.value === "function" ? this.value() : this.value;
  }
  async toThrow(expected?: ErrorMatcher): Promise<void> {
    if (this.negated) return void (await assert.doesNotReject(this.promise()));
    await assert.rejects(this.promise(), (error) => expected === undefined || matchError(error, expected));
  }
  async toBeInstanceOf(ctor: abstract new (...args: any[]) => unknown): Promise<void> {
    if (this.negated) return void (await assert.doesNotReject(this.promise()));
    await assert.rejects(this.promise(), (error) => error instanceof ctor);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type ErrorMatcher = RegExp | string | (abstract new (...args: any[]) => unknown); // eslint-disable-line @typescript-eslint/no-explicit-any

function matchError(error: unknown, expected: ErrorMatcher): boolean {
  if (typeof expected === "function") return error instanceof expected;
  const message = error instanceof Error ? error.message : String(error);
  return typeof expected === "string" ? message.includes(expected) : expected.test(message);
}

function matchObject(actual: unknown, expected: Record<string, unknown>): boolean {
  if (actual === null || typeof actual !== "object") return false;
  const target = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (!matchObject(target[key], value as Record<string, unknown>)) return false;
    } else if (!deepEqual(target[key], value)) {
      return false;
    }
  }
  return true;
}

export interface Expect {
  (actual: unknown): Assertion;
  arrayContaining(items: readonly unknown[]): ArrayContaining;
  unreachable(message?: string): never;
}

export const expect: Expect = Object.assign((actual: unknown) => new Assertion(actual), {
  arrayContaining: (items: readonly unknown[]): ArrayContaining => new ArrayContaining(items),
  unreachable: (message = "reached unreachable code"): never => assert.fail(message),
});

/** A minimal spy: a callable that records its calls under `.mock.calls`. */
export interface MockFn {
  (...args: unknown[]): unknown;
  mock: { calls: unknown[][] };
}

export function fn(impl?: (...args: unknown[]) => unknown): MockFn {
  const calls: unknown[][] = [];
  const mock = ((...args: unknown[]) => {
    calls.push(args);
    return impl?.(...args);
  }) as MockFn;
  mock.mock = { calls };
  return mock;
}
