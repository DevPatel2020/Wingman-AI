// Shared Tailwind class strings so all panels look consistent.

export const panelCls = "mt-4 w-full liquid-glass chat-container p-4 flex flex-col gap-3 text-xs text-gray-700"
export const btnBase =
  "rounded-md px-2.5 py-1 text-[11px] leading-none border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
export const btnNeutral = `${btnBase} bg-white/60 hover:bg-white/80 text-gray-700 border-gray-300/60`
export const btnPrimary = `${btnBase} bg-gray-700/85 hover:bg-gray-800 text-white border-gray-600/50`
export const btnDanger = `${btnBase} bg-red-500/80 hover:bg-red-500 text-white border-red-600/40`
export const inputCls =
  "w-full rounded-lg px-3 py-2 bg-white/60 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400/60 border border-white/40"
export const cardCls = "rounded-lg bg-white/75 border border-white/40 p-3"
export const headingCls = "font-semibold text-gray-800 text-sm"
