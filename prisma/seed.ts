import { PrismaClient, Role, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  // ─── SCHOOL SETTINGS ────────────────────────
  const existingSettings = await prisma.schoolSettings.findFirst();
  if (!existingSettings) {
    await prisma.schoolSettings.create({
      data: {
        name: "Sunrise International School",
        motto: "Knowledge · Character · Excellence",
        address: "15 Education Road, Lagos",
        phone: "+234 801 234 5678",
        email: "info@sunrise.edu.ng",
        principal: "Dr. Amina Yusuf",
      },
    });
    console.log("✅ School settings created");
  }

  // ─── ADMIN ──────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@school.com" },
    update: {},
    create: {
      email: "admin@school.com",
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      role: Role.ADMIN,
      phone: "+2348000000001",
    },
  });
  console.log("✅ Admin:", admin.email);

  // ─── TEACHER ────────────────────────────────
  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@school.com" },
    update: {},
    create: {
      email: "teacher@school.com",
      passwordHash,
      firstName: "Jane",
      lastName: "Okoro",
      role: Role.TEACHER,
      phone: "+2348000000002",
    },
  });

  const teacher = await prisma.staff.upsert({
    where: { staffNo: "TCH-001" },
    update: {},
    create: {
      userId: teacherUser.id,
      staffNo: "TCH-001",
      department: "Academic",
      position: "Teacher",
      hireDate: new Date("2023-01-15"),
      isTeaching: true,
    },
  });
  console.log("✅ Teacher:", teacherUser.email);

  // ─── EXTRA STAFF ────────────────────────────
  const staffUser = await prisma.user.upsert({
    where: { email: "staff@school.com" },
    update: {},
    create: {
      email: "staff@school.com",
      passwordHash,
      firstName: "Chinedu",
      lastName: "Eze",
      role: Role.STAFF,
      phone: "+2348000000003",
    },
  });

  await prisma.staff.upsert({
    where: { staffNo: "STF-001" },
    update: {},
    create: {
      userId: staffUser.id,
      staffNo: "STF-001",
      department: "Administration",
      position: "Clerk",
      hireDate: new Date("2022-06-01"),
      isTeaching: false,
    },
  });

  // ─── ACADEMIC YEAR + TERMS ──────────────────
  const year = await prisma.academicYear.upsert({
    where: { name: "2025/2026" },
    update: {},
    create: {
      name: "2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isActive: true,
    },
  });

  await prisma.term.createMany({
    data: [
      {
        academicYearId: year.id,
        name: "First Term",
        startDate: new Date("2025-09-01"),
        endDate: new Date("2025-12-15"),
        isActive: true,
      },
      {
        academicYearId: year.id,
        name: "Second Term",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-04-10"),
        isActive: false,
      },
      {
        academicYearId: year.id,
        name: "Third Term",
        startDate: new Date("2026-04-20"),
        endDate: new Date("2026-07-31"),
        isActive: false,
      },
    ],
    skipDuplicates: true,
  });

  // ─── SUBJECTS ───────────────────────────────
  const subjects = [
    { name: "Mathematics", code: "MATH" },
    { name: "English Language", code: "ENG" },
    { name: "Basic Science", code: "SCI" },
    { name: "Social Studies", code: "SOS" },
    { name: "Computer Studies", code: "CSC" },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }

  // ─── CLASSES ────────────────────────────────
  const classNames = ["Grade 7A", "Grade 7B", "Grade 8A", "Grade 9A"];
  const createdClasses: { id: string; name: string }[] = [];

  for (const name of classNames) {
    const cls = await prisma.class.upsert({
      where: { name },
      update: {},
      create: {
        name,
        level: name.replace(/[A-Z]$/, "").trim(),
        capacity: 40,
        formTeacherId: name === "Grade 7A" ? teacher.id : null,
      },
    });
    createdClasses.push(cls);
  }
  console.log("✅ Classes created");

  // ─── PARENT ─────────────────────────────────
  const parentUser = await prisma.user.upsert({
    where: { email: "parent@school.com" },
    update: {},
    create: {
      email: "parent@school.com",
      passwordHash,
      firstName: "Adebayo",
      lastName: "Johnson",
      role: Role.PARENT,
      phone: "+2348000000004",
    },
  });

  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
      relationship: "Father",
      occupation: "Engineer",
    },
  });
  console.log("✅ Parent:", parentUser.email);

  // ─── STUDENTS ───────────────────────────────
  const studentData = [
    { firstName: "Chioma", lastName: "Okafor", gender: Gender.FEMALE, class: "Grade 7A", adm: "ADM-2025-001" },
    { firstName: "Emeka", lastName: "Nwosu", gender: Gender.MALE, class: "Grade 7A", adm: "ADM-2025-002" },
    { firstName: "Fatima", lastName: "Bello", gender: Gender.FEMALE, class: "Grade 7A", adm: "ADM-2025-003" },
    { firstName: "Tunde", lastName: "Adeyemi", gender: Gender.MALE, class: "Grade 7B", adm: "ADM-2025-004" },
    { firstName: "Ngozi", lastName: "Eze", gender: Gender.FEMALE, class: "Grade 8A", adm: "ADM-2025-005" },
    { firstName: "Ibrahim", lastName: "Musa", gender: Gender.MALE, class: "Grade 8A", adm: "ADM-2025-006" },
    { firstName: "Blessing", lastName: "Okoro", gender: Gender.FEMALE, class: "Grade 9A", adm: "ADM-2025-007" },
    { firstName: "David", lastName: "Johnson", gender: Gender.MALE, class: "Grade 7A", adm: "ADM-2025-008" }, // child of parent
  ];

  for (const s of studentData) {
    const classId = createdClasses.find((c) => c.name === s.class)?.id;

    const student = await prisma.student.upsert({
      where: { admissionNo: s.adm },
      update: {},
      create: {
        admissionNo: s.adm,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        dateOfBirth: new Date("2012-05-15"),
        classId,
        status: "ACTIVE",
      },
    });

    // Link David Johnson to the parent
    if (s.adm === "ADM-2025-008") {
      await prisma.parentStudent.upsert({
        where: {
          parentId_studentId: {
            parentId: parent.id,
            studentId: student.id,
          },
        },
        update: {},
        create: {
          parentId: parent.id,
          studentId: student.id,
          isPrimary: true,
        },
      });
    }
  }
  console.log("✅ Students created");

  console.log("\n🎉 Seed completed successfully!");
  console.log("────────────────────────────────────────");
  console.log("Login accounts (password for all: password123)");
  console.log("  Admin:   admin@school.com");
  console.log("  Teacher: teacher@school.com");
  console.log("  Parent:  parent@school.com");
  console.log("  Staff:   staff@school.com");
  console.log("────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
