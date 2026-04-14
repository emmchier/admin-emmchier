export function Navbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 backdrop-blur-sm">
      <span className="text-sm font-semibold tracking-tight text-neutral-900 sm:text-base">
        Admin emmchier
      </span>
      <button
        type="button"
        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50"
      >
        Iniciar sesión
      </button>
    </header>
  );
}
