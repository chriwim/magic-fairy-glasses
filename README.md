# Magic Fairy Glasses

A gentle Android web app for young children and their grown-ups. Animated original placeholder fairies can float in a tracked AR view, over a live camera view, or in a camera-free fairy garden.

## Requirements

- Node.js 22.12 or newer (Node 24 LTS recommended) and npm.
- Chrome on Android with WebGL. Tracked AR additionally needs WebXR immersive AR, a compatible device and its required AR runtime. Availability varies by device, browser, operating system and runtime; camera mode and the garden provide alternatives.
- Camera and immersive AR require a secure context: HTTPS, or `localhost` for local development. A phone visiting a development server over a plain HTTP LAN address is not a secure context. Deploy to HTTPS or use a properly configured HTTPS development environment to test on a phone.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The production build is in `dist/`; serve that directory at the origin root over HTTPS with normal static-file hosting. Test service-worker behavior using the production build: the development server does not enable the production service worker. Vite's preview server is for local testing, not production hosting.

Open the app once online and wait for the offline-ready message. In Chrome on Android, use the browser's **Install app** or **Add to Home screen** menu, then open the installed app. After the first successful cache, the app shell and all bundled fairy assets can load offline; an interrupted initial cache, a browser-cleared cache, updates, or installation/setup of the device's AR runtime may still require a network connection. Updates are offered in the app rather than applied during play.

## Playing and privacy

An adult should help the child start and supervise play in a safe space. Choose:

- **Find fairies in AR:** if supported and permitted, fairies appear in front of the initial view and remain in the session's local coordinate space as the phone moves. Tracking can drift or be interrupted and is not saved across sessions. The on-screen × exits; the camera symbol exits and offers camera mode for photos. Some devices show these controls as shapes in the 3D view instead of HTML buttons.
- **Open magic camera:** the rear camera is requested after a tap, with the fairies overlaid in screen space. They do not track real-world locations. Tap the shutter to download a PNG of the camera view and fairies; check the device's Downloads to confirm it was saved. Camera image capture is unavailable in the tracked AR view, because browsers may not expose the composed camera image.
- **Explore without a camera:** the same fairies appear in a simple garden without requesting camera permission.

Tap fairies for a reaction. Camera permission can be denied or revoked; the app offers a retry and camera-free alternative. Camera tracks are stopped when the camera view is left or the page is backgrounded. There is no backend, account, analytics, advertising, microphone access, or photo upload. Photos are only downloaded locally; deleting or sharing them is controlled by the device.

## Verification

`npm test` checks crop calculations, compositing order, camera readiness, export failures, download cleanup, camera permission/cancellation, simulated mode transitions, and first-pose world placement. `npm run build` also type-checks the app. For release, test the actual supported Android devices in both browser and installed modes, including offline launch after caching, camera permission denial/retry, leaving and reopening the camera, portrait and landscape photos, tapping fairies, and AR entry, tracking, exit and switching to the camera. Desktop and simulated-camera checks cannot establish Android WebXR, camera hardware, or installability behavior.
