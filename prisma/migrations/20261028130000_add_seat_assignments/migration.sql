-- Электронная рассадка класса: 8 рядов × 3 парты × 2 места.
CREATE TABLE "SeatAssignment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "desk" INTEGER NOT NULL DEFAULT 1,
    "side" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeatAssignment_classId_row_desk_side_key"
    ON "SeatAssignment"("classId", "row", "desk", "side");

CREATE INDEX "SeatAssignment_classId_idx"
    ON "SeatAssignment"("classId");

ALTER TABLE "SeatAssignment"
    ADD CONSTRAINT "SeatAssignment_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
