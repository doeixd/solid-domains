import { createEffect, onSettled } from 'solid-js'

/**
 * Ref directive factories: 2.0's replacement for `use:` directives. The
 * factory body is the owned setup phase (create effects, register cleanup);
 * the returned callback is the apply phase and only touches the element.
 */

/** Drives a native <dialog> from a signal: showModal() gives focus trapping and inertness for free. */
export const modal = (isOpen: () => boolean, onClose: () => void) => {
  let dialog: HTMLDialogElement | undefined
  createEffect(isOpen, open => {
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  })
  return (element: HTMLDialogElement) => {
    dialog = element
    // Escape fires `cancel`; route it through state instead of letting the
    // browser close the dialog behind the signal's back.
    element.addEventListener('cancel', event => {
      event.preventDefault()
      onClose()
    })
  }
}

/** Reports an element's content-box width, for the virtual list's column count. */
export const observeWidth = (onWidth: (width: number) => void) => {
  let observer: ResizeObserver | undefined
  onSettled(() => () => observer?.disconnect())
  return (element: HTMLElement) => {
    observer = new ResizeObserver(([entry]) => {
      if (entry) onWidth(entry.contentRect.width)
    })
    observer.observe(element)
  }
}
