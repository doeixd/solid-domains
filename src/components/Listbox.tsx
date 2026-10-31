import { For, Show, createEffect, createSignal, onFlush } from 'solid-js'

import { CheckIcon, ChevronDownIcon } from './Icons'

const TYPEAHEAD_RESET_MS = 500

/**
 * A select-only listbox (WAI-ARIA pattern): focus stays on the list while
 * `aria-activedescendant` tracks the active option. Supports arrow keys,
 * Home/End, Enter/Space, Escape, Tab, and typeahead.
 */
export function Listbox<T extends string>(props: {
  id: string
  value: T
  options: readonly T[]
  toLabel: (value: T) => string
  toSearchText?: (value: T) => string
  ariaLabel: string
  onSelect: (value: T) => void
}) {
  const [isOpen, setOpen] = createSignal(false)
  const [activeIndex, setActiveIndex] = createSignal(0)
  let button!: HTMLButtonElement
  let list: HTMLUListElement | undefined
  let typeahead = ''
  let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

  const optionId = (index: number) => `${props.id}-option-${index}`

  const open = () => {
    setActiveIndex(Math.max(0, props.options.indexOf(props.value)))
    setOpen(true)
  }

  const close = (shouldRefocus = true) => {
    setOpen(false)
    if (shouldRefocus) button.focus()
  }

  const choose = (value: T) => {
    // Land the close on its own frame: selecting a price sort starts async
    // work, and without onFlush the menu would stay open while it is held.
    onFlush(() => setOpen(false))
    button.focus()
    props.onSelect(value)
  }

  createEffect(isOpen, isNowOpen => {
    if (isNowOpen) list?.focus({ preventScroll: true })
  })

  createEffect(
    () => (isOpen() ? activeIndex() : -1),
    index => {
      if (index >= 0) document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' })
    },
  )

  const searchText = (value: T) => (props.toSearchText ?? props.toLabel)(value).toLowerCase()

  const onListKeyDown = (event: KeyboardEvent) => {
    const last = props.options.length - 1
    const move = (index: number) => {
      event.preventDefault()
      setActiveIndex(Math.min(last, Math.max(0, index)))
    }
    switch (event.key) {
      case 'ArrowDown':
        return move(activeIndex() + 1)
      case 'ArrowUp':
        return move(activeIndex() - 1)
      case 'Home':
      case 'PageUp':
        return move(0)
      case 'End':
      case 'PageDown':
        return move(last)
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const value = props.options[activeIndex()]
        if (value !== undefined) choose(value)
        return
      }
      case 'Escape':
        event.preventDefault()
        return close()
      case 'Tab':
        return close(false)
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      clearTimeout(typeaheadTimer)
      typeahead += event.key.toLowerCase()
      typeaheadTimer = setTimeout(() => (typeahead = ''), TYPEAHEAD_RESET_MS)
      const match = props.options.findIndex(option => searchText(option).startsWith(typeahead))
      if (match !== -1) move(match)
    }
  }

  const onButtonKeyDown = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      open()
    }
  }

  return (
    <div class="filter-listbox">
      <button
        ref={button}
        id={`${props.id}-button`}
        type="button"
        class="filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen() ? 'true' : 'false'}
        aria-controls={`${props.id}-options`}
        aria-label={`${props.ariaLabel}: ${props.toLabel(props.value)}`}
        onClick={() => (isOpen() ? close() : open())}
        onKeyDown={onButtonKeyDown}
      >
        <span class="filter-trigger-content">
          <span class="filter-trigger-label">{props.toLabel(props.value)}</span>
          <ChevronDownIcon />
        </span>
      </button>
      <Show when={isOpen()}>
        <div class="filter-backdrop" onClick={() => close(false)} />
        <ul
          ref={element => (list = element)}
          id={`${props.id}-options`}
          role="listbox"
          tabindex="0"
          class="filter-options"
          aria-label={props.ariaLabel}
          aria-activedescendant={optionId(activeIndex())}
          style={{ '--button-width': `${button.offsetWidth}px` }}
          onKeyDown={onListKeyDown}
          onFocusOut={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget !== button) {
              close(false)
            }
          }}
        >
          <For each={props.options}>
            {(option, index) => (
              <li
                id={optionId(index())}
                role="option"
                class="filter-option"
                aria-selected={option === props.value ? 'true' : 'false'}
                data-active={index() === activeIndex()}
                data-selected={option === props.value}
                onClick={() => choose(option)}
                onPointerMove={() => setActiveIndex(index())}
              >
                <span class="filter-option-content">
                  <span class="filter-option-check">
                    <CheckIcon />
                  </span>
                  <span>{props.toLabel(option)}</span>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
