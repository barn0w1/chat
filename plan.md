# Frontend Refactor Plan

## 1. Current Code Analysis

### Architecture problems

**`App.tsx` is a god component.**
It owns all app state (5 `useState` hooks), all event processing logic (6 `useCallback` handlers), typing timer management (a `useRef<Map>` with inline `setTimeout`/`clearTimeout`), snackbar lifecycle, identity persistence, and message ID generation. It is impossible to test any business logic in isolation — every state transition is spread across ad-hoc callbacks that are only reachable through the WebSocket hook.

**`useWebSocket` has two jobs.**
It manages a WebSocket connection *and* parses/routes every message type via a multi-callback interface. The pattern of receiving six callbacks and immediately routing into them means adding a new server event type requires editing three files (types, hook, App). The `reconnecting` state returned by the hook is never used.

**Global mutable `msgCounter`.**
`let msgCounter = 0` is a module-level variable. It leaks across hot-module reloads and cannot be reset or tested. Should be a `useRef` or `crypto.randomUUID()`.

**Side effects during render.**
`window.location.replace('/ch/1')` is called synchronously in the component body when `channel === 0`. Side effects during render are React anti-patterns and cause strict-mode issues. This should be in a `useEffect`.

**`IdentitySheet` writes to localStorage.**
The `handleSubmit` in `IdentitySheet` calls `localStorage.setItem`. Persistence is a side effect and belongs at the app boundary where identity state lives, not inside a UI component.

**`onJoin`/`onLeave` signature mismatch.**
The `WSCallbacks` interface declares `onJoin(name, emoji, ts)` with three args, but `App.tsx` defines `onJoin(name, emoji)` with two — the `ts` is silently dropped. This compiles because of structural typing but represents a genuine disconnect.

**Fragile cast in `useWebSocket`.**
`cbRef.current.onMsg(msg as unknown as WireMsg)` is a double cast through `unknown` — the canonical escape hatch when types don't match. The proper fix is parsing the discriminated union with type narrowing.

---

### Performance problems

**No memoization anywhere.**
Every state change in `App.tsx` re-renders all six child components without exception. A typing indicator update re-renders the message list; a new online user re-renders the input bar. `React.memo` is missing from every component.

**`MessageBubble` is never stable.**
History messages (old, immutable) are re-rendered on every new arrival because `MessageList` passes a fresh `grouped` boolean computed inline during render. There is no `React.memo` on `MessageBubble`, so even unchanged items get full re-renders.

**`grouped` is recomputed on every render.**
`MessageList` loops through `messages` and derives `grouped` for each item during render. This should be computed once in the reducer when the message is appended and stored as part of the message model.

**`checkNearBottom` is recreated on every render.**
The function is defined inline inside the component body without `useCallback`, creating a new function reference on every render. This also means it is not stable when passed to `onScroll`.

**Scroll uses `scrollTo` toward `scrollHeight`.**
This works but requires reading layout properties from the DOM. The idiomatic pattern for "scroll last item into view" is a sentinel `<div ref={bottomRef}` and `bottomRef.current?.scrollIntoView()`, which lets the browser calculate geometry and avoids the `scrollHeight` read.

**TypingIndicator bouncing dots animate unconditionally.**
The three dots have CSS `animation` applied at all times (even when `opacity: 0`). While not catastrophically expensive, it is wasted animation work.

---

### UI problems

**Timestamp on every bubble is noisy.**
In a grouped run of messages from the same sender, each bubble shows its own timestamp. This clutters the thread. The timestamp should appear only on the last bubble in each group.

**No scroll-to-bottom affordance.**
When the user scrolls up to read history and new messages arrive, there is no visual indicator or button to return to the bottom, and no count of unread messages.

**No empty state.**
A freshly joined channel with no history shows a blank white area with no messaging to orient the user.

**Date separators are absent.**
Messages that span multiple days give no visual landmarks. A minimal "Today", "Yesterday", or date label between groups from different days is a standard chat expectation.

**Online user chips overflow with no fallback.**
With many users, the chip row overflows. There is no truncation or count like "6 online". The horizontal scroll is invisible (`scrollbar-none`) so users don't know it exists.

**Channel jump is a bare `<input type="number">`.**
The browser-native number spinner and validation styling are inconsistent with MD3. The placeholder "ch" is not descriptive. Pressing Enter is the only affordance.

**Reconnecting banner sits over the message list.**
The `fixed top-14` overlay covers messages without adjusting layout. A better pattern is a narrow inline banner that pushes layout down, or a connection indicator integrated into `TopAppBar`.

**`IdentitySheet` has no exit animation.**
When the user submits identity, the sheet unmounts immediately without animating out, making the transition jarring.

---

## 2. Proposed Architecture

### Principle: one place for effects, one place for state logic

```
App.tsx            — composes hooks + components. zero business logic.
  ├── useChatReducer()           → { state, dispatch }
  ├── useWebSocket(…, dispatch)  → { send, connected }
  ├── useTyping(send)            → { handleInput, clearTyping }
  └── useTypingExpiry(state.typingUsers, dispatch)  (small effect-only hook)
```

**`useChatReducer`** wraps `useReducer` with a pure reducer. State transitions are total functions: `(state, action) => state`. Every server event, every UI event, becomes a named action. The reducer can be imported and unit tested without React.

**`useWebSocket`** accepts `dispatch: Dispatch<ChatAction>` instead of six callbacks. It has a single outgoing interface. The message parser narrows the `ServerEvent` union properly and dispatches typed actions. All reconnect logic stays here — it is the one place for WebSocket effects.

**`useTypingExpiry`** is a tiny hook whose only job is: for each name in `typingUsers`, start a 3-second timer; when it fires, dispatch `{ type: 'TYPING_EXPIRE', name }`. It owns its timer refs and cleans them up. This isolates the "typing auto-clear" side effect without polluting App or the reducer.

**`useTyping`** is unchanged in responsibility — it sends typing events to the server.

### State shape

```ts
interface ChatState {
  messages:    ChatMsg[]        // includes grouped flag, computed on append
  onlineUsers: User[]
  typingUsers: string[]
  snackbars:   SnackbarItem[]
  identity:    Identity | null  // moves from App useState into reducer
  connected:   boolean
}
```

Moving `identity` and `connected` into the reducer means the entire app state is one coherent snapshot. A single `dispatch` call can atomically update dependent slices.

### Action union

```ts
type ChatAction =
  | { type: 'HISTORY';        msgs: WireStoredMsg[] }
  | { type: 'MSG_RECEIVED';   msg: WireMsg }
  | { type: 'JOIN';           name: string; emoji: string }
  | { type: 'LEAVE';          name: string; emoji: string }
  | { type: 'ONLINE';         users: User[] }
  | { type: 'TYPING_START';   name: string }
  | { type: 'TYPING_EXPIRE';  name: string }
  | { type: 'TYPING_STOP';    name: string }
  | { type: 'SNACKBAR_ADD';   text: string }
  | { type: 'SNACKBAR_REMOVE';id: string }
  | { type: 'SET_IDENTITY';   identity: Identity }
  | { type: 'SET_CONNECTED';  connected: boolean }
```

### Data flow (one direction)

```
Server WS frame
  → useWebSocket parses + dispatch(action)
  → reducer(state, action) → new state
  → React propagates to memoized components
  → components render, never mutate
```

User input follows the same path: `InputBar` calls `send()` (effect) and `clearTyping()` (effect). State reflecting the sent message arrives back via the server echo.

### Component responsibilities (render only)

All components become pure view functions — they receive props, return JSX, no side effects. Each is wrapped in `React.memo`. Components that receive stable-reference props (callbacks from `useCallback`, primitive values) skip re-renders automatically.

### File structure

```
src/
  state/
    actions.ts       — ChatAction union type
    reducer.ts       — pure chatReducer + initial state
  hooks/
    useChatReducer.ts   — useReducer wrapper
    useWebSocket.ts     — connection + dispatch
    useTyping.ts        — send typing events to server
    useTypingExpiry.ts  — auto-expire typing state
  components/
    TopAppBar.tsx
    MessageList.tsx
    MessageBubble.tsx
    TypingIndicator.tsx
    InputBar.tsx
    IdentitySheet.tsx
    Snackbar.tsx
  App.tsx
  types.ts
  index.css
  main.tsx
  vite-env.d.ts
```

---

## 3. Performance plan

### `React.memo` everywhere

Every component gets `React.memo`. Components with callback props use `useCallback` in App (already done for most, will be extended for dispatch-based callbacks).

### `grouped` flag in model, not derived in render

`ChatMsg` gains a `grouped: boolean` field. The reducer sets it when appending: `grouped = prev.name === msg.name && prev.emoji === msg.emoji`. `MessageList` no longer loops to compute grouping — it just reads `msg.grouped`.

### `MessageBubble` stability

With `grouped` in the model and `msg.id` as the key, `React.memo` means history messages never re-render after initial paint. Only the last message in a new group gets a `grouped: false` → re-render if the next message from the same person arrives, which is correct behaviour.

### Scroll sentinel

Replace the `scrollHeight - scrollTop - clientHeight` calculation with:

```tsx
const bottomRef = useRef<HTMLDivElement>(null)
// on new message (when near bottom):
bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
```

The sentinel `<div ref={bottomRef} />` sits after the last bubble. `scrollIntoView` is lazy — no layout reads needed.

### `content-visibility: auto` on bubble rows

Adding `content-visibility: auto; contain-intrinsic-size: 0 60px` to each message row tells the browser to skip layout and paint for off-screen bubbles. For a chat history of hundreds of messages, this dramatically reduces rendering cost with zero JS virtualization.

### Timestamp per group, not per bubble

Showing a timestamp only on the last bubble of each group halves the number of timestamp elements rendered. `ChatMsg` already has a `grouped` flag; a complementary `isLastInGroup` flag (set in reducer) determines timestamp visibility.

### Stop animating invisible dots

When `typingUsers.length === 0`, render the dots with `animation: none` (or don't render the dots at all, keeping only the height placeholder).

---

## 4. UI plan

### Scroll-to-bottom FAB

When `!nearBottom && messages.length > 0`, render a small FAB (Floating Action Button) anchored to the bottom-right of the message list. It shows an unread count badge if new messages arrived while scrolled up. Clicking it smooth-scrolls to bottom.

### Empty state

When `messages.length === 0` and connected, render a centered illustration area with copy: "No messages yet. Say hello!"

### Date separators

Between consecutive messages from different calendar days, render a centred date chip: "Today", "Yesterday", or a short locale date string. Computed in a `useMemo` pass in `MessageList` that produces a list of `{ type: 'date'; label: string } | { type: 'msg'; msg: ChatMsg }` items.

### Timestamp on last bubble only

Each `MessageBubble` receives an `isLastInGroup: boolean` prop. Timestamp renders only when `isLastInGroup` is true. This visually untangles dense message runs.

### Online count in TopAppBar

When `onlineUsers.length > 4`, render the first 3 chips then a `+N` chip instead of all chips. The full list is visible on click (or can stay as a tooltip for simplicity).

### Channel jump as a proper field

Replace `<input type="number">` with a styled text field that mirrors the MD3 outlined text field pattern already used in `IdentitySheet`. Use `inputmode="numeric"` for mobile keyboards without browser spinners.

### Reconnecting indicator in TopAppBar

Move the reconnecting state into `TopAppBar` as a subtle colour change on the channel badge (surface-container-high with an animated indicator) + subtitle text, instead of a fixed overlay.

### IdentitySheet exit animation

Before unmounting `IdentitySheet`, animate it out (`translateY(100%)`, fade scrim to 0). Achievable with a `closing` boolean state that triggers the CSS transition; `onTransitionEnd` removes the component. The `identity` is submitted optimistically so the chat becomes interactive immediately.

---

## 5. Granular Todo List

### Architecture

- [ ] Create `src/state/actions.ts` — define `ChatAction` union type
- [ ] Create `src/state/reducer.ts` — pure `chatReducer(state, action)` + `initialState`
  - [ ] Handle `HISTORY` (set messages, compute grouped flags)
  - [ ] Handle `MSG_RECEIVED` (append, compute grouped + isLastInGroup, fix previous last-in-group)
  - [ ] Handle `JOIN` / `LEAVE` (push snackbar)
  - [ ] Handle `ONLINE` (replace onlineUsers)
  - [ ] Handle `TYPING_START` / `TYPING_STOP` / `TYPING_EXPIRE`
  - [ ] Handle `SNACKBAR_ADD` / `SNACKBAR_REMOVE`
  - [ ] Handle `SET_IDENTITY` (write to localStorage as side-effect-free computed step — actual write in hook)
  - [ ] Handle `SET_CONNECTED`
- [ ] Create `src/hooks/useChatReducer.ts` — wraps `useReducer`, returns `{ state, dispatch }`
- [ ] Refactor `src/hooks/useWebSocket.ts` to accept `dispatch: Dispatch<ChatAction>` replacing all callbacks
  - [ ] Add proper type narrowing for `ServerEvent` union (remove `as unknown as` casts)
  - [ ] Dispatch `SET_CONNECTED` on open/close
  - [ ] Remove unused `reconnecting` return value
- [ ] Create `src/hooks/useTypingExpiry.ts` — timer-based auto-expire hook
- [ ] Update `src/types.ts`
  - [ ] Add `grouped: boolean` and `isLastInGroup: boolean` to `ChatMsg`
  - [ ] Remove `live` from `ChatMsg` (replace with `isNew` or compute at dispatch time)
- [ ] Refactor `App.tsx`
  - [ ] Remove all `useState` (state moves to reducer)
  - [ ] Remove all `useCallback` event handlers (logic moves to reducer)
  - [ ] Remove `typingTimers` ref (moves to `useTypingExpiry`)
  - [ ] Remove `msgCounter` global (use `crypto.randomUUID()` in reducer)
  - [ ] Move `window.location.replace` into `useEffect`
  - [ ] Move `localStorage.setItem` identity write into identity dispatch handler
  - [ ] Remove `reconnecting` from `useWebSocket` destructuring (unused)
  - [ ] Wire `useChatReducer` → `useWebSocket(dispatch)` → components
- [ ] Move `localStorage.setItem('identity', …)` from `IdentitySheet` to the `SET_IDENTITY` reducer action handler (side-effect in dispatch middleware or App `useEffect`)

### Performance

- [ ] Wrap `MessageBubble` in `React.memo`
- [ ] Wrap `MessageList` in `React.memo`
- [ ] Wrap `TopAppBar` in `React.memo`
- [ ] Wrap `TypingIndicator` in `React.memo`
- [ ] Wrap `InputBar` in `React.memo`
- [ ] Wrap `IdentitySheet` in `React.memo`
- [ ] Replace `checkNearBottom` + `scrollTo` with a bottom sentinel `ref` + `scrollIntoView`
- [ ] Add `content-visibility: auto; contain-intrinsic-size: 0 64px` to message row wrappers
- [ ] Stop animating typing dots when list is empty (`animation: none`)
- [ ] Use `useCallback` for `handleSend`, `handleIdentitySubmit`, `removeSnackbar` in App

### UI

- [ ] Show timestamp only on `isLastInGroup` bubble, not every bubble
- [ ] Add scroll-to-bottom FAB (renders when `!nearBottom`)
- [ ] Add unread count badge on the FAB (count messages received while scrolled up)
- [ ] Add empty state in `MessageList` when `messages.length === 0`
- [ ] Add date separators between messages from different calendar days
- [ ] Truncate online user chip list to first 3 + `+N` overflow chip in `TopAppBar`
- [ ] Replace channel jump `<input type="number">` with MD3 styled text field (`inputmode="numeric"`)
- [ ] Move reconnecting state into `TopAppBar` (replace fixed overlay banner)
- [ ] Add exit animation to `IdentitySheet` (slide down + scrim fade before unmount)
- [ ] Run `npx tsc --noEmit` — fix all type errors
- [ ] Run `npm run build` — confirm clean build
