"use client";

import { useState, useTransition } from "react";
import { createBook, loanBook, returnBook } from "@/server/actions/library";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";
import { Plus, BookOpen } from "lucide-react";

type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  shelfLocation: string | null;
};

type Loan = {
  id: string;
  dueDate: string;
  status: string;
  book: { title: string; author: string };
  borrower: { firstName: string; lastName: string; email: string };
};

interface Props {
  books: Book[];
  loans: Loan[];
  borrowers: { id: string; firstName: string; lastName: string; email: string; role: string }[];
  userRole: string;
}

export function LibraryClient({ books, loans, borrowers, userRole }: Props) {
  const [tab, setTab] = useState<"books" | "loans">("books");
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [message, setMessage] = useState("");
  const canManage = ["ADMIN", "LIBRARIAN"].includes(userRole);

  function handleAddBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createBook({
          title: fd.get("title") as string,
          author: fd.get("author") as string,
          isbn: (fd.get("isbn") as string) || undefined,
          category: (fd.get("category") as string) || undefined,
          totalCopies: Number(fd.get("totalCopies") || 1),
          shelfLocation: (fd.get("shelfLocation") as string) || undefined,
        });
        setShowAdd(false);
        setMessage("Book added");
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  function handleLoan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await loanBook({
          bookId: fd.get("bookId") as string,
          borrowerId: fd.get("borrowerId") as string,
          dueDate: fd.get("dueDate") as string,
        });
        setShowLoan(false);
        setMessage("Book loaned successfully");
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  function handleReturn(loanId: string) {
    startTransition(async () => {
      await returnBook(loanId);
      setMessage("Book returned");
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {message}
          <button className="ml-3 underline" onClick={() => setMessage("")}>dismiss</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "books" ? "default" : "outline"} onClick={() => setTab("books")}>
            <BookOpen className="h-4 w-4 mr-1.5" /> Books
          </Button>
          <Button size="sm" variant={tab === "loans" ? "default" : "outline"} onClick={() => setTab("loans")}>
            Active Loans
          </Button>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowLoan(!showLoan); setShowAdd(false); }}>
              Loan Book
            </Button>
            <Button size="sm" onClick={() => { setShowAdd(!showAdd); setShowLoan(false); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Book
            </Button>
          </div>
        )}
      </div>

      {showAdd && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add Book</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAddBook} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Title</Label><Input name="title" required /></div>
              <div className="space-y-1.5"><Label>Author</Label><Input name="author" required /></div>
              <div className="space-y-1.5"><Label>ISBN</Label><Input name="isbn" /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input name="category" placeholder="Fiction / Science" /></div>
              <div className="space-y-1.5"><Label>Copies</Label><Input name="totalCopies" type="number" min="1" defaultValue={1} /></div>
              <div className="space-y-1.5"><Label>Shelf Location</Label><Input name="shelfLocation" placeholder="A-12" /></div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={isPending}>Save</Button>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showLoan && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Loan a Book</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleLoan} className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Book</Label>
                <select name="bookId" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  {books.filter((b) => b.availableCopies > 0).map((b) => (
                    <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} left)</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Borrower</Label>
                <select name="borrowerId" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>{b.lastName} {b.firstName} ({b.role})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input name="dueDate" type="date" required />
              </div>
              <div className="sm:col-span-3 flex gap-2">
                <Button type="submit" disabled={isPending}>Loan</Button>
                <Button type="button" variant="outline" onClick={() => setShowLoan(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === "books" && (
        <Card>
          <CardContent className="pt-4">
            {books.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No books yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Author</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Available</th>
                    <th className="pb-2 font-medium">Shelf</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{b.title}</td>
                      <td className="py-3">{b.author}</td>
                      <td className="py-3 text-muted-foreground">{b.category || "—"}</td>
                      <td className="py-3">
                        <span className={cn(
                          "font-medium",
                          b.availableCopies === 0 ? "text-red-600" : "text-emerald-600"
                        )}>
                          {b.availableCopies} / {b.totalCopies}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{b.shelfLocation || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "loans" && (
        <Card>
          <CardContent className="pt-4">
            {loans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No active loans.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Book</th>
                    <th className="pb-2 font-medium">Borrower</th>
                    <th className="pb-2 font-medium">Due Date</th>
                    <th className="pb-2 font-medium">Status</th>
                    {canManage && <th className="pb-2 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{l.book.title}</td>
                      <td className="py-3">{l.borrower.lastName} {l.borrower.firstName}</td>
                      <td className="py-3">{formatDate(l.dueDate)}</td>
                      <td className="py-3">
                        <span className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          l.status === "OVERDUE" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                        )}>
                          {l.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3 text-right">
                          <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleReturn(l.id)}>
                            Return
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
