# Gesto Fly — Coding Guidelines

## 🖐️ Finger-Hover Interaction Rule (HIGH PRIORITY)

**Every interactive button in the app MUST support finger-hover (gesture dwell) interaction.**

The primary input method is the player's hand in front of the webcam — there is no mouse. All buttons must be reachable and activatable via the `useGestureDwell` composable.

### How to implement dwell on a button

1. Accept a `cursorPos: { x: number; y: number }` prop (pixel coordinates, already transformed).
2. Add a `ref` to each button element (use a native `<button>` element so refs return an `HTMLElement` directly).
3. Create a dwell instance per button: `const myDwell = useGestureDwell({ onComplete: () => ... })`.
4. `watch` the `cursorPos` prop and call `checkButtons(x, y)` — start or cancel each dwell based on `getBoundingClientRect()` hit-testing.
5. In the template, bind `:class="{ hovering: myDwell.isActive.value }"` and render the progress bar:
   ```html
   <div
     v-if="myDwell.isActive.value"
     class="btn-progress"
     :style="{ width: myDwell.progress.value + '%' }"
   ></div>
   ```
6. Keep `@click` on the button as a fallback for mouse/touch users.

### CSS required on every dwell-enabled button

```css
.my-btn {
  position: relative; /* or absolute — either works */
  overflow: hidden;   /* clips the progress bar */
  transition: transform 0.2s;
}
.my-btn.hovering {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
}
.btn-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 4px;
  background: #00ff00;
  transition: width 0.1s linear;
}
```

### Exception

The **camera permission error retry button** (`CameraInput.vue`) is exempt because it only appears when hand tracking is unavailable (no camera access), making gesture input impossible at that point.

### Reference implementations

See `StartMenu.vue`, `GameHud.vue` (EXIT button), `GameOverOverlay.vue`, and `LeaderboardOverlay.vue` for complete working examples.
