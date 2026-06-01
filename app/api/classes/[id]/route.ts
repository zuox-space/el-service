export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { students } = body;

    const classData = await prisma.class.update({
      where: { id: params.id },
      data: {
        students: JSON.stringify(students),
      },
    });

    return NextResponse.json({ success: true, class: classData });
  } catch (error) {
    console.error("Error updating class:", error);
    return NextResponse.json({ error: "Failed to update class" }, { status: 500 });
  }
}