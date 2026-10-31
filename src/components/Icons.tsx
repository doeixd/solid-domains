/**
 * Icons are defined once in an SVG sprite (rendered by Document) and
 * referenced with <use>. Rows repeat the cart icon dozens of times, so this
 * keeps the server HTML small: every reference is a few bytes instead of the
 * full paths. Stroke styling lives on `.icon` in styles.css and inherits into
 * the referenced symbol.
 */
const Icon = (props: { id: string }) => (
  <svg aria-hidden="true" class="icon" width="24" height="24">
    <use href={`#${props.id}`} />
  </svg>
)

export const IconSprite = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <symbol id="i-cart" viewBox="0 0 24 24">
      <path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18" />
      <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25" />
      <circle cx="18" cy="20" r="2" />
      <circle cx="8" cy="20" r="2" />
    </symbol>
    <symbol id="i-search" viewBox="0 0 24 24">
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </symbol>
    <symbol id="i-close" viewBox="0 0 24 24">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </symbol>
    <symbol id="i-filter" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </symbol>
    <symbol id="i-check" viewBox="0 0 24 24">
      <path d="M20 6 9 17l-5-5" />
    </symbol>
    <symbol id="i-arrow-up-right" viewBox="0 0 24 24">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </symbol>
    <symbol id="i-chevron-down" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </symbol>
    <symbol id="i-retry" viewBox="0 0 24 24">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </symbol>
    <symbol id="i-bolt" viewBox="0 0 24 24">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </symbol>
  </svg>
)

export const CartIcon = () => <Icon id="i-cart" />

export const SearchIcon = () => <Icon id="i-search" />

export const CloseIcon = () => <Icon id="i-close" />

export const FilterIcon = () => <Icon id="i-filter" />

export const CheckIcon = () => <Icon id="i-check" />

export const ArrowUpRightIcon = () => <Icon id="i-arrow-up-right" />

export const ChevronDownIcon = () => <Icon id="i-chevron-down" />

export const RetryIcon = () => <Icon id="i-retry" />

export const BoltIcon = () => <Icon id="i-bolt" />
