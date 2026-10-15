import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLearningLibrary } from "@/server/actions/learning-library";
import { getClasses } from "@/server/actions/attendance";
import { getSubjects } from "@/server/actions/exams";
import { LearningLibraryClient } from "@/components/learning-library/learning-library-client";

export default async function LearningLibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const isStaff = ["ADMIN", "MANAGER", "TEACHER"].includes(role as string);

  // Only staff and students use this page for now
  if (!isStaff && role !== "STUDENT") redirect("/dashboard/materials");

  const [{ items, studentClass }, classes, subjects] = await Promise.all([
    getLearningLibrary(),
    isStaff ? getClasses() : Promise.resolve([]),
    isStaff ? getSubjects() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Learning Library</h1>
        <p className="text-muted-foreground">
          {isStaff
            ? "Videos, notes, stories, worksheets and past questions, organised by section (Lower Classes, Primary, Junior Secondary, Senior Secondary), then subject and topic."
            : studentClass
              ? `Learning materials for ${studentClass}.`
              : "Learning materials for your class."}
        </p>
      </div>
      <LearningLibraryClient
        items={JSON.parse(JSON.stringify(items))}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        userRole={role}
        userId={session.user.id}
        studentClass={studentClass}
      />
    </div>
  );
}
