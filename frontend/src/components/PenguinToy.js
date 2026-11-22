import { useEffect, useRef, useState } from 'react';
import './PenguinToy.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function PenguinToy() {
  const toyRef = useRef(null);
  const areaRef = useRef(null);
  const animationRef = useRef(0);
  const dragRef = useRef(null);
  const motionRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, rotation: 0, angularVelocity: 0, lastTime: 0 });
  const [motion, setMotion] = useState(motionRef.current);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => cancelAnimationFrame(animationRef.current), []);

  const bounds = () => {
    const area = areaRef.current?.getBoundingClientRect();
    const toy = toyRef.current?.getBoundingClientRect();
    if (!area || !toy) return { x: 0, y: 0 };
    return {
      minX: -(area.width * 0.76 - toy.width / 2),
      maxX: area.width * 0.24 - toy.width / 2,
      y: Math.max(0, (area.height - toy.height) / 2),
    };
  };

  const animate = (time) => {
    const state = motionRef.current;
    const area = bounds();
    const dt = Math.min((time - (state.lastTime || time)) / 1000, 0.032);
    state.lastTime = time;
    state.vy += 1450 * dt;
    state.vx *= Math.exp(-0.55 * dt);
    state.angularVelocity *= Math.exp(-1.2 * dt);
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    state.rotation += state.angularVelocity * dt;

    if (state.x > area.maxX || state.x < area.minX) {
      state.x = clamp(state.x, area.minX, area.maxX);
      state.vx *= -0.68;
      state.angularVelocity += state.vx * 0.018;
    }
    if (state.y > area.y || state.y < -area.y) {
      state.y = clamp(state.y, -area.y, area.y);
      state.vy *= -0.68;
      state.angularVelocity += state.vx * 0.012;
      if (Math.abs(state.vy) < 42) state.vy = 0;
    }

    setMotion({ ...state });
    if (Math.abs(state.vx) + Math.abs(state.vy) + Math.abs(state.angularVelocity) > 10 || state.y < area.y - 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      state.vx = 0;
      state.vy = 0;
      state.angularVelocity = 0;
      state.lastTime = 0;
    }
  };

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    cancelAnimationFrame(animationRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: motionRef.current.x,
      originY: motionRef.current.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
    };
    motionRef.current.vx = 0;
    motionRef.current.vy = 0;
    setDragging(true);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const area = bounds();
    const now = performance.now();
    const elapsed = Math.max(now - drag.lastTime, 1);
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    drag.vx = deltaX / elapsed * 1000;
    drag.vy = deltaY / elapsed * 1000;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    const state = motionRef.current;
    const previousX = state.x;
    state.x = clamp(drag.originX + event.clientX - drag.startX, area.minX, area.maxX);
    state.y = clamp(drag.originY + event.clientY - drag.startY, -area.y, area.y);
    state.rotation = clamp(state.rotation + (state.x - previousX) * 0.12, -24, 24);
    setMotion({ ...state });
  };

  const finishDrag = (event, shouldThrow = true) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!shouldThrow || reducedMotion) {
      motionRef.current.vx = 0;
      motionRef.current.vy = 0;
      motionRef.current.rotation *= 0.6;
      setMotion({ ...motionRef.current });
      return;
    }
    motionRef.current.vx = clamp(drag.vx * 1.3, -1250, 1250);
    motionRef.current.vy = clamp(drag.vy * 1.3, -1250, 1250);
    motionRef.current.angularVelocity = clamp(drag.vx * 0.035, -12, 12);
    motionRef.current.lastTime = 0;
    animationRef.current = requestAnimationFrame(animate);
  };

  const keyToss = (event) => {
    const impulse = { ArrowLeft: [-320, -100], ArrowRight: [320, -100], ArrowUp: [0, -460], ArrowDown: [0, 360] }[event.key];
    if (!impulse) return;
    event.preventDefault();
    cancelAnimationFrame(animationRef.current);
    motionRef.current.vx = impulse[0];
    motionRef.current.vy = impulse[1];
    motionRef.current.lastTime = 0;
    animationRef.current = requestAnimationFrame(animate);
  };

  return <div className="penguin-toy-area" ref={areaRef}>
    <button
      ref={toyRef}
      type="button"
      className={`penguin-toy${dragging ? ' is-dragging' : ''}`}
      title="Drag and toss the penguin"
      aria-label="Drag and toss the LinuxLab penguin. Use arrow keys to bounce it."
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={(event) => finishDrag(event)}
      onPointerCancel={(event) => finishDrag(event, false)}
      onKeyDown={keyToss}
      style={{ transform: `translate(-50%, -50%) translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotation}deg)` }}
    ><img src="/logo-page.png" alt="" draggable="false"/></button>
  </div>;
}
