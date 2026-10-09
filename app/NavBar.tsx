'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Chat' },
  { href: '/products', label: 'Add Product' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        <span className="mr-4 font-semibold">AI SDK DevDigest</span>
        {links.map(({ href, label }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded px-3 py-1.5 text-sm transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
