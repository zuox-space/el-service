import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
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

    const updatedClass = await prisma.class.update({
      where: { id: params.id },
      data: {
        students: JSON.stringify(students),
      },
    });

    return NextResponse.json({ success: true, class: updatedClass });
  } catch (error) {
    console.error("Error updating students:", error);
    return NextResponse.json({ error: "Failed to update students" }, { status: 500 });
  }
}