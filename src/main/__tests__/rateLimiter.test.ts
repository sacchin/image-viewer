import test from 'node:test';
import assert from 'node:assert/strict';

import { RateLimiter } from '../external/rateLimiter';

/** Manual clock: time only moves when the test says so. */
const makeClock = () => {
  let t = 0;
  const sleeps: Array<{ ms: number; resolve: () => void }> = [];
  return {
    now: () => t,
    sleep: (ms: number) => new Promise<void>((resolve) => sleeps.push({ ms, resolve })),
    sleeps,
    /** Fire the oldest pending sleep after advancing the clock by its duration. */
    async tick() {
      const s = sleeps.shift();
      if (!s) {
        throw new Error('no pending sleep');
      }
      t += s.ms;
      s.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    advance(ms: number) {
      t += ms;
    },
  };
};

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

test('runs the first task immediately and spaces the next by minIntervalMs', async () => {
  const clock = makeClock();
  const limiter = new RateLimiter({ minIntervalMs: 1000, maxConcurrency: 4 }, clock);
  const started: number[] = [];
  const task = () => {
    started.push(clock.now());
    return Promise.resolve('x');
  };

  const p1 = limiter.schedule(task);
  const p2 = limiter.schedule(task);
  assert.deepEqual(started, [0]);
  assert.equal(clock.sleeps.length, 1);
  assert.equal(clock.sleeps[0].ms, 1000);

  await clock.tick();
  assert.deepEqual(started, [0, 1000]);
  assert.deepEqual(await Promise.all([p1, p2]), ['x', 'x']);
});

test('never exceeds maxConcurrency', async () => {
  const clock = makeClock();
  const limiter = new RateLimiter({ minIntervalMs: 0, maxConcurrency: 2 }, clock);
  const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
  let running = 0;
  let peak = 0;
  const task = (i: number) => async () => {
    running += 1;
    peak = Math.max(peak, running);
    await gates[i].promise;
    running -= 1;
  };

  const all = Promise.all([0, 1, 2].map((i) => limiter.schedule(task(i))));
  assert.equal(limiter.running, 2);
  assert.equal(limiter.pending, 1);

  gates[0].resolve();
  await new Promise((r) => setImmediate(r)); // let then/finally/pump settle
  assert.equal(limiter.running, 2, 'third task starts once a slot frees');
  assert.equal(limiter.pending, 0);

  gates[1].resolve();
  gates[2].resolve();
  await all;
  assert.equal(peak, 2);
  assert.equal(limiter.running, 0);
});

test('a rejected task frees its slot and propagates the error', async () => {
  const clock = makeClock();
  const limiter = new RateLimiter({ minIntervalMs: 0, maxConcurrency: 1 }, clock);
  await assert.rejects(limiter.schedule(() => Promise.reject(new Error('boom'))), /boom/);
  assert.equal(limiter.running, 0);
  assert.equal(await limiter.schedule(() => Promise.resolve(1)), 1);
});

test('does not sleep when enough time has already passed', async () => {
  const clock = makeClock();
  const limiter = new RateLimiter({ minIntervalMs: 500, maxConcurrency: 1 }, clock);
  await limiter.schedule(() => Promise.resolve());
  clock.advance(600);
  await limiter.schedule(() => Promise.resolve());
  assert.equal(clock.sleeps.length, 0);
});
