"use client";

import { cn } from "@/lib/cn";

/**
 * Skeleton — заглушка загрузки. Используется вместо спиннера там, где известна
 * структура будущего контента (список, карточка), чтобы не было скачка вёрстки.
 */
export interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    /** Скругление: control под текст, card под блоки, full под аватары */
    radius?: "control" | "card" | "overlay" | "full";
    className?: string;
}

const radiusMap = {
    control: "rounded-control",
    card: "rounded-card",
    overlay: "rounded-overlay",
    full: "rounded-full",
};

export function Skeleton({ width, height = 16, radius = "control", className }: SkeletonProps) {
    return (
        <span
            aria-hidden
            className={cn("block animate-pulse bg-skeleton", radiusMap[radius], className)}
            style={{ width, height }}
        />
    );
}

/** SkeletonText — несколько строк подряд, последняя короче (имитация текста). */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <span className={cn("flex flex-col gap-2", className)}>
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton key={index} height={12} width={index === lines - 1 ? "60%" : "100%"} />
            ))}
        </span>
    );
}
