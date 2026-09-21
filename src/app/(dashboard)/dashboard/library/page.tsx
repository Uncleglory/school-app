import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBooks, getActiveLoans, getBorrowers } from "@/server/actions/library";
import { LibraryClient } from "@/components/library/library-client";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [books, loans, borrowers] = await Promise.all([
    getBooks(),
    getActiveLoans(),
    getBorrowers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground">Manage books, loans and returns.</p>
      </div>
      <LibraryClient
        books={JSON.parse(JSON.stringify(books))}
        loans={JSON.parse(JSON.stringify(loans))}
        borrowers={borrowers}
        userRole={session.user.role}
      />
    </div>
  );
}
