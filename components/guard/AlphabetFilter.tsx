"use client";

// components/guard/AlphabetFilter.tsx
import { cn } from "@/lib/cn";

const LETTERS = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

/** Алфавитный фильтр для списков охраны. */
export function AlphabetFilter({
    value,
    onChange,
}: {
    value: string;
    onChange: (letter: string) => void;
}) {
    return (
        <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max items-center gap-1">
                <button
                    type="button"
                    onClick={() => onChange("all")}
                    className={cn(
                        "h-10 shrink-0 rounded-control px-3 text-sm font-medium transition-colors",
                        value === "all"
                            ? "bg-accent-solid font-semibold text-accent-fg shadow-card"
                            : "text-fg-muted hover:bg-surface-hover",
                    )}
                >
                    Все
                </button>
                {LETTERS.map(letter => (
                    <button
                        key={letter}
                        type="button"
                        onClick={() => onChange(letter === value ? "all" : letter)}
                        className={cn(
                            "h-10 w-10 shrink-0 rounded-control text-base transition-colors",
                            value === letter
                                ? "bg-accent-solid font-bold text-accent-fg shadow-card ring-2 ring-accent/30"
                                : "text-fg-muted hover:bg-surface-hover",
                        )}
                    >
                        {letter}
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Первая буква фамилии: «Ё» считаем как «Е». */
export function surnameLetter(name: string): string {
    const first = name.trim().charAt(0).toUpperCase().replace("Ё", "Е");
    return LETTERS.includes(first) ? first : "";
}
