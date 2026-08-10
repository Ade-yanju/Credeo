# Mobile (React Native / Expo)

The core discipline here is different from web: the goal is to feel like a native app the platform's own design language would produce, not a website in a frame. Default to **Expo** (managed workflow) unless the brief specifically needs bare React Native for a native module Expo doesn't support — it removes most native-tooling friction and every library below works with it.

## Navigation

- **Expo Router** (file-based, built on React Navigation) — the current default for new Expo apps; gives you native stack/tab/drawer navigators without hand-wiring React Navigation.
- **React Navigation** directly — use when you need finer control than Expo Router gives, or in a bare RN project.
- Pick a navigation *model* deliberately: bottom tab bar for 3-5 top-level destinations (the standard for consumer apps), stack navigation for drill-down flows, drawer only when there are many secondary destinations that don't fit a tab bar. A single top-level screen almost never needs tabs.

## Motion and gesture

- **React Native Reanimated 3** — the standard for performant, native-thread animation (avoids JS-thread jank). Default choice for anything beyond a simple opacity/scale transition.
- **React Native Gesture Handler** — pairs with Reanimated for swipe-to-dismiss, drag, pinch, pull-to-refresh, and other touch-native interactions users expect on mobile that don't have a web equivalent.
- **Moti** — a simpler declarative animation API built on Reanimated, good when you don't need Reanimated's full worklet API.
- **Lottie** (`lottie-react-native`) — same use case as on web: designer-authored vector animation.
- **expo-haptics** — use real haptic feedback on meaningful interactions (confirmations, toggles, errors) — this is one of the fastest ways to make an app feel native rather than web-wrapped, and it's free to add.

## Native-feel primitives and styling

- **React Native Paper** — Material Design 3 components, best when the brief wants a clean Android-native or cross-platform Material look.
- **Tamagui** — performant, themeable, cross-platform (RN + web) component system with a real design-token story; good choice when the product spans web and mobile and needs shared tokens without shared UI code.
- **NativeWind** — Tailwind syntax for React Native styling, useful if the team's web app already uses Tailwind and wants a consistent authoring pattern (styling only — it doesn't give you components).
- **React Native Skia** — GPU-accelerated 2D graphics/canvas, for custom illustrations, charts, or effects native components can't achieve.
- Respect `SafeAreaView`/`useSafeAreaInsets` (from `react-native-safe-area-context`) on every screen — ignoring notches and home-indicator space is one of the fastest ways to make an app look unfinished.

## Platform-adaptive design

- Use `Platform.select()` or platform-specific file extensions (`.ios.tsx` / `.android.tsx`) where the two platforms genuinely warrant different treatment: back navigation (swipe-from-edge on iOS vs. hardware/gesture back on Android), action sheets (iOS `ActionSheetIOS` / native feel vs. Material bottom sheet), and iconography (SF Symbols–style vs. Material icons) are the most common places this matters.
- Hit targets should be at least 44×44pt (iOS HIG) / 48×48dp (Material) — don't shrink tappable areas to match a visual size that looks right only on a mouse-precision web layout.
- Prefer bottom sheets (`@gorhom/bottom-sheet`) over modals-that-cover-the-whole-screen for secondary content and actions — it's the mobile-native pattern users expect, versus a web-style dialog.

## 3D on mobile

- **@react-three/fiber** works in React Native via `expo-gl` and `react-native-webgl` for lightweight 3D. For anything heavier, consider a pre-rendered Lottie/video asset instead — mobile GPU/battery budgets are much tighter than web, and unnecessary 3D is one of the fastest ways to tank performance on mid-range devices. See `motion-3d.md` for the cost/benefit framework.

## Performance and polish defaults

- Use `FlashList` (Shopify) instead of `FlatList` for any list of meaningful length — large perf difference for near-zero API change.
- Test dark mode from the start (`useColorScheme`) rather than retrofitting it — most users expect native apps to respect system appearance.
- Image loading: `expo-image` over the bare `Image` component for caching and better placeholder/transition support.
