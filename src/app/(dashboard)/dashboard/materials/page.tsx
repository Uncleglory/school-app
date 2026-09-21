import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMaterials } from "@/server/actions/materials";
import { getClasses } from "@/server/actions/attendance";
import { getSubjects } from "@/server/actions/exams";
import { MaterialsClient } from "@/components/materials/materials-client";

export default async function MaterialsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [materials, classes, subjects] = await Promise.all([
    getMaterials(),
    getClasses(),
    getSubjects(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teaching Materials</h1>
        <p className="text-muted-foreground">
          Notes, assignments, slides and past papers for students.
        </p>
      </div>
      <MaterialsClient
        materials={JSON.parse(JSON.stringify(materials))}
        classes={classes}
        subjects={subjects}
        userRole={session.user.role}
      />
    </div>
  );
}
