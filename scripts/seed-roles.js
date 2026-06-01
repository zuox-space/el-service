const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function seedRoles() {
  const roles = [
    { name: "TEACHER", description: "Учитель (базовый доступ)" },
    { name: "CLASS_TEACHER", description: "Классный руководитель" },
    { name: "METHODIST", description: "Методист" },
    { name: "HEAD_TEACHER", description: "Завуч" },
    { name: "ADMIN", description: "Администратор" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    console.log(`✅ Роль "${role.name}" создана`);
  }

  console.log("🎉 Все роли созданы!");
}

seedRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());