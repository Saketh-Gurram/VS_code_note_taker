export interface GameLoop {
  start(): void;
  stop(): void;
}

export function createGameLoop(
  update: (dt: number) => void,
  render: () => void
): GameLoop {
  let rafId = 0;
  let lastTime = 0;
  let running = false;

  function tick(time: number) {
    if (!running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.1); // cap at 100ms
    lastTime = time;
    update(dt);
    render();
    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}
