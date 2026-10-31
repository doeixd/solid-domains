import { createContext, createSignal } from 'solid-js'

export type DialogName = 'cart' | 'filters' | 'tld' | 'inspector'

export const SEARCH_INPUT_ID = 'domain-search'

/** Which dialog is open. Only one can be at a time, like the reference app. */
export const createUi = () => {
  const [dialog, setDialog] = createSignal<DialogName | null>(null)
  return {
    dialog,
    isOpen: (name: DialogName) => dialog() === name,
    open: (name: DialogName) => setDialog(name),
    close: () => setDialog(null),
    focusSearch: () => document.getElementById(SEARCH_INPUT_ID)?.focus({ preventScroll: true }),
  }
}

export type Ui = ReturnType<typeof createUi>

export const UiContext = createContext<Ui>()
