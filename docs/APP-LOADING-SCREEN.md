# App loading screen

The HTML contains the initial branded overlay, inline colours, the original symbol, accessible Loading LOCAIZ status and responsive icon and title sizing. The initial route commit releases inert content and removes the loader after its short fade. Reduced motion uses a static indicator and immediate removal. Readiness follows the route commit and does not wait for images or unrelated API calls. Subsequent lazy routes use a compact status within the app shell.

An initial module script failure shows a reload control. A stalled startup switches to the same recovery interface after 30 seconds. If the React route throws, the app error boundary dismisses the initial loader and presents its reload control.

Unit coverage checks original paths and logo variants. Browser checks cover first-paint colour, stalled and failed lazy routes, storage errors, responsive sizing, fast toggles and reduced motion.
