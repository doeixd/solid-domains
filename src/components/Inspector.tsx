import { Loading, Show, createMemo, createSignal, lazy, onSettled, useContext } from 'solid-js'

import { DomainsContext } from '../lib/domainsClient'
import { modal } from '../lib/refs'
import { UiContext } from '../lib/ui'
import { BoltIcon } from './Icons'

/** Header button; pulses while requests are in flight. */
export function InspectorButton() {
  const client = useContext(DomainsContext)
  const ui = useContext(UiContext)
  const inFlight = createMemo(() => client.inspect().inFlight)

  // Cache activity differs between the server render and the hydrating
  // client, so the live indicator switches on only once the page has settled.
  const [isLive, setLive] = createSignal(false)
  onSettled(() => {
    setLive(true)
  })

  return (
    <button
      type="button"
      class="button inspector-toggle"
      aria-label="Under the hood: Solid 2.0 inspector"
      aria-haspopup="dialog"
      onClick={() => ui.open('inspector')}
    >
      <BoltIcon />
      <span class="inspector-toggle-label">Solid 2.0</span>
      <Show when={isLive() && inFlight() > 0}>
        <span class="inspector-pulse" />
      </Show>
    </button>
  )
}

// The panel is code-split: it loads the first time the inspector opens.
const InspectorPanel = lazy(() => import('./InspectorPanel'))

export function Inspector() {
  const ui = useContext(UiContext)

  return (
    <>
      <dialog
        ref={modal(() => ui.isOpen('inspector'), ui.close)}
        class="dialog-overlay"
        aria-labelledby="inspector-title"
      >
        <Show when={ui.isOpen('inspector')}>
          <div class="dialog-backdrop is-light" aria-hidden="true" onClick={ui.close} />
          <Loading fallback={<section class="side-panel inspector-panel" aria-busy="true" />}>
            <InspectorPanel />
          </Loading>
        </Show>
      </dialog>
    </>
  )
}
