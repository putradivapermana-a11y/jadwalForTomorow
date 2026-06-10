import Link from "next/link";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto py-10 px-4 md:px-8">
      <div className="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
        <aside className="w-full md:w-1/4">
          <nav className="flex flex-col space-y-1">
            <Link
              href="/settings/personality"
              className="bg-muted hover:bg-muted font-medium px-3 py-2 rounded-md text-sm"
            >
              Personality Profile
            </Link>
            <Link
              href="/"
              className="hover:bg-muted font-medium px-3 py-2 rounded-md text-sm text-muted-foreground"
            >
              Back
            </Link>
          </nav>
        </aside>
        <div className="flex-1 max-w-3xl">{children}</div>
      </div>
    </div>
  );
}