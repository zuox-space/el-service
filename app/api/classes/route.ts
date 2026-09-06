// app/api/classes/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsByClass } from "@/lib/mysql_db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json([]);
    }

    // Получаем пользователя из БД по email
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    if (!dbUser) {
      return NextResponse.json([]);
    }

    // 1. Получаем классы, где пользователь - владелец
    const myClasses = await prisma.class.findMany({
      where: { ownerId: dbUser.id }
    });

    // 2. Получаем ID классов, которыми поделились с пользователем
    const shares = await prisma.classShare.findMany({
      where: { teacherId: dbUser.id }
    });

    const sharedClassIds = shares.map(s => s.classId);

    // 3. Получаем классы, которыми поделились (только их!)
    const sharedClasses = await prisma.class.findMany({
      where: { id: { in: sharedClassIds } }
    });

    // 4. Объединяем
    const allUserClasses = [
      ...myClasses.map(cls => ({
        ...cls,
        isOwner: true,
        isShared: false
      })),
      ...sharedClasses.map(cls => ({
        ...cls,
        isOwner: false,
        isShared: true
      }))
    ];

    // 5. Получаем студентов из MySQL для каждого класса
    const parsedClasses = await Promise.all(
      allUserClasses.map(async (cls) => {
        try {
          // Получаем студентов из MySQL по названию класса
          const studentsFromMySQL = await getStudentsByClass(cls.name);

          // Форматируем студентов в нужный формат
          const formattedStudents = studentsFromMySQL.map((student, index) => ({
            id: student.aisId,
            name: student.name,
          }));
          console.log(formattedStudents)
          return {
            ...cls,
            // Заменяем students на данные из MySQL
            students: formattedStudents,
            // Добавляем мета-информацию
            _meta: {
              source: 'mysql',
              count: formattedStudents.length,
              className: cls.name
            }
          };
        } catch (error) {
          console.error(`Error fetching students for class ${cls.name}:`, error);
          // В случае ошибки возвращаем пустой массив
          return {
            ...cls,
            students: [],
            _meta: {
              source: 'mysql',
              error: 'Failed to fetch students',
              className: cls.name
            }
          };
        }
      })
    );

    console.log(`User ${dbUser.email} has ${myClasses.length} own classes and ${sharedClasses.length} shared classes`);
    console.log(`Total students loaded from MySQL: ${parsedClasses.reduce((acc, cls) => acc + cls.students.length, 0)}`);

    return NextResponse.json(parsedClasses);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json([]);
  }
}