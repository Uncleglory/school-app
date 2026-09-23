import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUsers } from "@/server/actions/users";
import { UsersClient } from "@/components/users/users-client";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Create logins for teachers, parents, staff, accountants and librarians.
        </p>
      </div>
      <UsersClient users={JSON.parse(JSON.stringify(users))} />
    </div>
  );
}
