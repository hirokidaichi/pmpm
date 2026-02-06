import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="glass flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <span className="font-display text-6xl font-bold text-teal-400/50">
          404
        </span>
        <h2 className="font-display text-lg font-bold text-white/90">
          Page Not Found
        </h2>
        <p className="text-sm text-white/50">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
