"use client";

// app/my-class/page.tsx
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    AlertTriangle,
    Archive,
    ArrowLeft,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    FileText,
    HelpCircle,
    Info,
    PenSquare,
    Plane,
    Plus,
    Shield,
    ShieldAlert,
    Sparkles,
    Thermometer,
    Trash2,
    Trophy,
    UserCheck,
} from "lucide-react";
import WeekListScrollable from "@/components/ui/WeekListScrollable";
import PassModal from "@/components/ui/PassModal";
import AttendanceModal from "@/components/ui/AttendanceModal";
import ClassSelector from "@/components/ui/ClassSelector";
import SelfExitModal from "@/components/ui/SelfExitModal";
import ViolationModal from "@/components/ui/ViolationModal";
import { ResolveViolationModal } from "@/components/ui/ResolveViolationModal";
import { ViolationAccordion } from "@/components/ui/ViolationAccordion";
import AuthorizationModal from "@/components/ui/AuthorizationModal";
import {
    Badge,
    Button,
    Chip,
    Card,
    EmptyState,
    InlineLoading,
    SearchInput,
    List,
    ListItem,
    Modal,
    ModalFooter,
    Skeleton,
    Tabs,
    useToast,
} from "@/components/ui/kit";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { useAccess } from "@/components/access/AccessProvider";
import { MobilePageHeader } from "@/components/shell/MobilePageHeader";
import { NoAccess } from "@/components/access/NoAccess";
import { formatDateRu } from "@/lib/date";
import { safeFormatShortName } from "@/lib/utils";

/**
 * Рабочий экран классного руководителя.
 *
 * Что изменилось:
 *  • один главный экшен на вкладку (primary), остальные — второстепенные:
 *    раньше каждый блок рисовал свою цветную кнопку с градиентом, и было непонятно,
 *    что нажимать первым;
 *  • все цвета — из темы: убраны `text-white` на светлых карточках (это и давало
 *    «белое на белом» в светлой теме) и градиенты cyan/indigo/rose;
 *  • причины отсутствия — иконки Lucide вместо эмодзи (не «прыгают» на iOS/Android);
 *  • вкладки на компоненте Tabs со счётчиками и прокруткой, без самодельных стрелок;
 *  • отмена самовыхода и отзыв доверенности — через подтверждение, а не один тап;
 *  • убраны два лишних запроса (`/api/news`, `/api/notes`): новости и заметки
 *    в интерфейсе не открывались.
 */

interface TabType {
    id: string;
    name: string;
    Icon: typeof FileText;
}

/** Строка списка отсутствующих: ученик, причина и её оформление. */
interface AbsentStudentRow {
    id: string;
    name: string;
    reasonId: string;
    reasonLabel: string;
    Icon: typeof Thermometer;
    tone: "danger" | "warning" | "neutral" | "info" | "accent";
}

/** Причины отсутствия: подпись, иконка и тон бейджа. */
const ABSENCE_REASONS: Record<
    string,
    { label: string; Icon: typeof Thermometer; tone: "danger" | "warning" | "neutral" | "info" | "accent" }
> = {
    sick: { label: "Болен", Icon: Thermometer, tone: "danger" },
    family: { label: "По заявлению родителей", Icon: FileText, tone: "warning" },
    other: { label: "Причина неясна", Icon: HelpCircle, tone: "neutral" },
    vacation: { label: "Отпуск", Icon: Plane, tone: "info" },
    competition: { label: "Соревнования", Icon: Trophy, tone: "accent" },
};

const absenceReason = (id: string) =>
    ABSENCE_REASONS[id] ?? { label: "Причина не указана", Icon: HelpCircle, tone: "neutral" as const };

export default function HomePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const toast = useToast();
    const { can, loading: accessLoading } = useAccess();

    const today = new Date();
    const [selectedDate, setSelectedDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [classes, setClasses] = useState<any[]>([]);

    const [schoolRecords, setSchoolRecords] = useState<any[]>([]);
    const [isLoadingSchoolRecords, setIsLoadingSchoolRecords] = useState(false);

    const [activeTab, setActiveTab] = useState<string>("attendance");

    const [isViolationModalOpen, setIsViolationModalOpen] = useState(false);
    const [isPassModalOpen, setIsPassModalOpen] = useState(false);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [isSelfExitModalOpen, setIsSelfExitModalOpen] = useState(false);
    const [isAuthorizationModalOpen, setIsAuthorizationModalOpen] = useState(false);

    const [passesHistory, setPassesHistory] = useState<any[]>([]);
    const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
    const [studentsList, setStudentsList] = useState<any[]>([]);
    const [selfExits, setSelfExits] = useState<any[]>([]);
    const [todayViolations, setTodayViolations] = useState<any[]>([]);
    // Все нарушения класса — ниже сегодняшних, со статусами и отработкой
    const [classViolations, setClassViolations] = useState<any[]>([]);
    const [isLoadingClassViolations, setIsLoadingClassViolations] = useState(false);
    const [resolveTargets, setResolveTargets] = useState<any[] | null>(null);
    // Показ всех нарушений класса: диапазон дат и «Показать ещё»
    const [classRange, setClassRange] = useState<"all" | "today" | "week" | "month">("all");
    // На мобильном вкладки живут в раскрывающемся меню — как панель фиксаций
    const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
    const tabMenuRef = useRef<HTMLDivElement | null>(null);

    // Меню закрывается по нажатию вне его
    useEffect(() => {
        if (!isTabMenuOpen) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (tabMenuRef.current && !tabMenuRef.current.contains(event.target as Node)) {
                setIsTabMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [isTabMenuOpen]);
    // Нарушения класса: поиск по фамилии и постраничная загрузка по 5
    const [classSearch, setClassSearch] = useState("");
    const [classSearchQuery, setClassSearchQuery] = useState("");
    const [classPage, setClassPage] = useState(1);
    const [classTotal, setClassTotal] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingViolations, setIsLoadingViolations] = useState(false);

    const [authorizations, setAuthorizations] = useState<any[]>([]);
    const [archivedAuthorizations, setArchivedAuthorizations] = useState<any[]>([]);
    const [isLoadingAuthorizations, setIsLoadingAuthorizations] = useState(false);
    const [authorizationTab, setAuthorizationTab] = useState<"active" | "archive">("active");

    // Подтверждения: отмена самовыхода и отзыв доверенности
    const [pendingSelfExit, setPendingSelfExit] = useState<{ id: string; studentName: string } | null>(null);
    const [pendingRevoke, setPendingRevoke] = useState<{ id: string; studentName: string } | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    const clearTime = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isSameDay = (date1: Date, date2: Date): boolean =>
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();

    const formatDateLocal = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const roles = (session?.user?.roles as string[]) || [];
    const isAdmin = roles.includes("ADMIN");
    const isClassTeacher = roles.includes("CLASS_TEACHER");

    const isJuniorClass = useMemo(() => {
        if (!selectedClass) return false;
        const grade = selectedClass.grade || parseInt(selectedClass.name?.match(/^(\d+)/)?.[1] || "0");
        return grade >= 1 && grade <= 4;
    }, [selectedClass]);

    const showJuniorFeatures = isJuniorClass;
    const hasClasses = classes.length > 0;
    const showWorkInterface = hasClasses || isClassTeacher;

    const tabs: TabType[] = useMemo(() => {
        const base: TabType[] = [
            { id: "attendance", name: "Главная", Icon: CheckCircle },
            { id: "violations", name: "Нарушения", Icon: AlertTriangle },
            { id: "schoolRecord", name: "ВШУ", Icon: ShieldAlert },
        ];

        if (showJuniorFeatures) {
            base.splice(1, 0, { id: "self-exit", name: "Самовыход", Icon: UserCheck });
            base.push({ id: "authorizations", name: "Доверенности", Icon: Shield });
        }

        return base;
    }, [showJuniorFeatures]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login");
    }, [status, router]);

    const handleLogout = async () => {
        await signOut({ redirect: true, callbackUrl: "/login" });
    };

    const getStudentsFromClass = useCallback((classData: any) => {
        if (!classData) return [];

        let students = classData.students;
        if (typeof students === "string") {
            try {
                students = JSON.parse(students);
            } catch {
                students = [];
            }
        }

        return Array.isArray(students) ? students : [];
    }, []);

    // Классы
    useEffect(() => {
        const fetchClasses = async () => {
            if (!session) return;

            try {
                const response = await fetch("/api/classes");
                const data = await response.json();

                if (Array.isArray(data) && data.length > 0) {
                    setClasses(data);
                    setSelectedClass(data[0]);
                    setStudentsList(getStudentsFromClass(data[0]));
                } else {
                    setClasses([]);
                    setSelectedClass(null);
                    setStudentsList([]);
                }
            } catch (error) {
                console.error("Error fetching classes:", error);
                setClasses([]);
                setSelectedClass(null);
                setStudentsList([]);
            } finally {
                setIsLoading(false);
            }
        };

        if (session) void fetchClasses();
    }, [session, getStudentsFromClass]);

    const handleClassChange = useCallback(
        (classData: any) => {
            setSelectedClass(classData);
            setStudentsList(getStudentsFromClass(classData));
        },
        [getStudentsFromClass],
    );

    // Данные выбранного дня: посещаемость, пропуска, самовыходы
    useEffect(() => {
        if (!selectedClass) return;

        const fetchData = async () => {
            try {
                const dateStr = formatDateLocal(selectedDate);

                const [attendanceRes, passesRes, selfExitRes] = await Promise.all([
                    fetch(`/api/attendance?classId=${selectedClass.id}&date=${dateStr}`),
                    fetch(`/api/passes?classId=${selectedClass.id}&date=${dateStr}`),
                    fetch(`/api/self-exit?classId=${selectedClass.id}&date=${dateStr}`),
                ]);

                // Каждый ответ разбираем отдельно: сбой одного раздела не должен
                // обнулять остальные (раньше любая ошибка очищала весь экран).
                const readJson = async (response: Response, fallback: unknown) => {
                    if (!response.ok) return fallback;
                    return response.json().catch(() => fallback);
                };

                const attendance = await readJson(attendanceRes, null);
                const passes = await readJson(passesRes, []);
                const selfExitData = await readJson(selfExitRes, []);

                setAttendanceHistory(attendance ? [attendance] : []);
                setPassesHistory(Array.isArray(passes) ? passes : []);
                setSelfExits(Array.isArray(selfExitData) ? selfExitData : []);
            } catch (error) {
                console.error("Error fetching data:", error);
                setAttendanceHistory([]);
                setPassesHistory([]);
                setSelfExits([]);
            }
        };

        void fetchData();
    }, [selectedClass, selectedDate]);

    // Все нарушения класса (для блока со статусами и отработкой)
    const loadClassViolations = useCallback(
        async (
            className: string,
            range: "all" | "today" | "week" | "month" = "all",
            search: string = "",
            page: number = 1,
            append: boolean = false,
        ) => {
            if (append) setIsLoadingMore(true);
            else setIsLoadingClassViolations(true);

            try {
                const params = new URLSearchParams({
                    className,
                    page: String(page),
                    pageSize: "5",
                    stats: "false",
                });

                if (range !== "all") {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (range === "week") start.setDate(start.getDate() - 6);
                    if (range === "month") start.setMonth(start.getMonth() - 1);
                    params.set("startDate", formatDateLocal(start));
                    params.set("endDate", formatDateLocal(now));
                }

                if (search.trim()) params.set("search", search.trim());

                const response = await fetch(`/api/violations?${params.toString()}`);
                if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

                const data = await response.json();
                const rows = Array.isArray(data) ? data : Array.isArray(data?.violations) ? data.violations : [];

                setClassViolations(previous => (append ? [...previous, ...rows] : rows));
                setClassTotal(typeof data?.total === "number" ? data.total : rows.length);
                setClassPage(page);
            } catch (error) {
                console.error("Error fetching class violations:", error);
                if (!append) setClassViolations([]);
            } finally {
                setIsLoadingClassViolations(false);
                setIsLoadingMore(false);
            }
        },
        [],
    );

    // Ввод в поиске не дёргает сервер на каждую букву
    useEffect(() => {
        const timer = setTimeout(() => setClassSearchQuery(classSearch.trim()), 350);
        return () => clearTimeout(timer);
    }, [classSearch]);

    useEffect(() => {
        if (!selectedClass || activeTab !== "violations") return;
        void loadClassViolations(selectedClass.name, classRange, classSearchQuery, 1, false);
    }, [selectedClass, activeTab, classRange, classSearchQuery, loadClassViolations]);

    // Нарушения за выбранную дату
    useEffect(() => {
        if (!selectedClass || activeTab !== "violations") return;

        let cancelled = false;

        const fetchViolations = async () => {
            setIsLoadingViolations(true);
            try {
                const dateStr = formatDateLocal(selectedDate);
                const response = await fetch(
                    `/api/violations?className=${encodeURIComponent(selectedClass.name)}&date=${dateStr}&pageSize=100`,
                );
                const data = await response.json();
                const rows = Array.isArray(data) ? data : Array.isArray(data?.violations) ? data.violations : [];
                if (!cancelled) setTodayViolations(rows);
            } catch (error) {
                console.error("Error fetching violations:", error);
                if (!cancelled) setTodayViolations([]);
            } finally {
                if (!cancelled) setIsLoadingViolations(false);
            }
        };

        void fetchViolations();
        return () => {
            cancelled = true;
        };
    }, [selectedClass, selectedDate, activeTab]);

    // Младшие вкладки недоступны для старших классов
    useEffect(() => {
        if (!showJuniorFeatures && (activeTab === "self-exit" || activeTab === "authorizations")) {
            setActiveTab("attendance");
        }
    }, [showJuniorFeatures, activeTab]);

    // ВШУ по классу
    useEffect(() => {
        if (!selectedClass || activeTab !== "schoolRecord") return;

        let cancelled = false;

        const fetchSchoolRecords = async () => {
            setIsLoadingSchoolRecords(true);
            try {
                const response = await fetch(
                    `/api/school-records/class?className=${encodeURIComponent(selectedClass.name)}`,
                );
                const data = await response.json();
                if (!cancelled) setSchoolRecords(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Error fetching school records:", error);
                if (!cancelled) setSchoolRecords([]);
            } finally {
                if (!cancelled) setIsLoadingSchoolRecords(false);
            }
        };

        void fetchSchoolRecords();
        return () => {
            cancelled = true;
        };
    }, [selectedClass, activeTab]);

    // Доверенности
    useEffect(() => {
        if (!selectedClass || activeTab !== "authorizations") return;

        let cancelled = false;

        const fetchAuthorizations = async () => {
            setIsLoadingAuthorizations(true);
            try {
                const [activeRes, archiveRes] = await Promise.all([
                    fetch(`/api/authorizations?className=${encodeURIComponent(selectedClass.name)}&active=true`),
                    fetch(`/api/authorizations?className=${encodeURIComponent(selectedClass.name)}&active=false`),
                ]);

                const activeData = await activeRes.json();
                const archiveData = await archiveRes.json();

                if (cancelled) return;
                setAuthorizations(Array.isArray(activeData) ? activeData : []);
                setArchivedAuthorizations(Array.isArray(archiveData) ? archiveData : []);
            } catch (error) {
                console.error("Error fetching authorizations:", error);
                if (!cancelled) {
                    setAuthorizations([]);
                    setArchivedAuthorizations([]);
                }
            } finally {
                if (!cancelled) setIsLoadingAuthorizations(false);
            }
        };

        void fetchAuthorizations();
        return () => {
            cancelled = true;
        };
    }, [selectedClass, activeTab]);

    const handleSubmitPass = async (passData: any) => {
        if (!selectedClass) throw new Error("Класс не выбран");

        const response = await fetch("/api/passes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: passData.date,
                classId: selectedClass.id,
                students: passData.students,
                exitTime: passData.exitTime,
                reason: passData.reason,
            }),
        });

        if (!response.ok) throw new Error("Не удалось оформить пропуск. Проверьте соединение и повторите.");

        const newPass = await response.json();
        setPassesHistory(previous => [newPass, ...previous]);

        toast.show({
            title: "Пропуск оформлен",
            description: `Выход в ${passData.exitTime} · учеников: ${passData.students?.length ?? 0}`,
            tone: "success",
        });
    };

    const handleSubmitAttendance = async (attendanceData: any) => {
        if (!selectedClass) throw new Error("Класс не выбран");

        const response = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...attendanceData, classId: selectedClass.id }),
        });

        if (!response.ok) throw new Error("Не удалось сохранить отметку. Проверьте соединение и повторите.");

        const newAttendance = await response.json();
        setAttendanceHistory([newAttendance]);

        toast.show({
            title: "Отметка сохранена",
            description: `Присутствуют: ${attendanceData.presentStudents?.length ?? 0} из ${(attendanceData.presentStudents?.length ?? 0) + (attendanceData.absentStudents?.length ?? 0)}`,
            tone: "success",
        });
    };

    const handleSubmitSelfExit = async (data: any) => {
        if (!selectedClass) throw new Error("Класс не выбран");

        const response = await fetch("/api/self-exit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, classId: selectedClass.id }),
        });

        if (!response.ok) throw new Error("Не удалось добавить самовыход. Попробуйте ещё раз.");

        const newSelfExit = await response.json();
        setSelfExits(previous => [newSelfExit, ...previous]);

        toast.show({ title: "Самовыход добавлен", description: data.studentName, tone: "success" });
    };

    const handleSubmitViolation = async (data: any) => {
        const response = await fetch("/api/violations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error("Не удалось сохранить нарушение. Попробуйте ещё раз.");

        const newViolation = await response.json();
        toast.show({ title: "Нарушение зафиксировано", description: data.studentName, tone: "success" });

        if (activeTab === "violations" && selectedClass) {
            const dateStr = formatDateLocal(selectedDate);
            const violationsRes = await fetch(
                `/api/violations?className=${encodeURIComponent(selectedClass.name)}&date=${dateStr}&pageSize=100`,
            );
            const violationsData = await violationsRes.json();
            const rows = Array.isArray(violationsData)
                ? violationsData
                : Array.isArray(violationsData?.violations)
                    ? violationsData.violations
                    : [];
            setTodayViolations(rows);
        }

        return newViolation;
    };

    const handleSubmitAuthorization = async (data: any) => {
        if (!selectedClass) throw new Error("Класс не выбран");

        const response = await fetch("/api/authorizations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, className: selectedClass.name }),
        });

        if (!response.ok) throw new Error("Не удалось добавить доверенность. Попробуйте ещё раз.");

        const newAuth = await response.json();
        setAuthorizations(previous => [newAuth, ...previous]);

        toast.show({
            title: "Доверенность добавлена",
            description: `${data.trustedName} · ${data.relation}`,
            tone: "success",
        });
    };

    const revokeAuthorization = async (id: string) => {
        try {
            const response = await fetch("/api/authorizations", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            if (!response.ok) throw new Error("Не удалось отозвать доверенность");

            const revoked = await response.json();
            setAuthorizations(previous => previous.filter(auth => auth.id !== id));
            setArchivedAuthorizations(previous => [revoked, ...previous]);

            toast.show({ title: "Доверенность отозвана", tone: "success" });
        } catch (error) {
            toast.show({
                title: error instanceof Error ? error.message : "Ошибка при отзыве",
                tone: "danger",
            });
        }
    };

    const cancelSelfExit = async (id: string, studentName: string) => {
        try {
            const response = await fetch(`/api/self-exit?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Не удалось отменить самовыход");

            setSelfExits(previous => previous.filter(exit => exit.id !== id));
            toast.show({ title: "Самовыход отменён", description: studentName, tone: "success" });
        } catch (error) {
            toast.show({
                title: error instanceof Error ? error.message : "Не удалось отменить самовыход",
                tone: "danger",
            });
        }
    };

    const canIssuePass = (date: Date) => clearTime(new Date(date)) >= clearTime(new Date());
    const canDeletePass = (passDate: Date) => clearTime(new Date(passDate)) >= clearTime(new Date());

    const deletePass = async (passId: string, passDate: Date) => {
        const now = new Date();
        const todayDate = clearTime(new Date());
        const passDateOnly = clearTime(new Date(passDate));

        if (passDateOnly < todayDate) {
            toast.show({ title: "Нельзя удалить пропуск за прошедшую дату", tone: "danger" });
            return;
        }

        if (isSameDay(passDateOnly, todayDate) && now.getHours() >= 15) {
            toast.show({ title: "Пропуск за сегодня нельзя удалить после 15:00", tone: "danger" });
            return;
        }

        try {
            const response = await fetch(`/api/passes?id=${passId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Не удалось удалить пропуск");

            setPassesHistory(previous => previous.filter(pass => pass.id !== passId));
            toast.show({ title: "Пропуск удалён", tone: "success" });
        } catch (error) {
            toast.show({
                title: error instanceof Error ? error.message : "Ошибка при удалении пропуска",
                tone: "danger",
            });
        }
    };

    const passesForSelectedDate = useMemo(
        () => (Array.isArray(passesHistory) ? passesHistory : []),
        [passesHistory],
    );
    const attendanceForSelectedDate = useMemo(
        () => (attendanceHistory && attendanceHistory.length > 0 ? attendanceHistory[0] : null),
        [attendanceHistory],
    );
    const absentStudentsOnSelectedDate = useMemo(
        () => attendanceForSelectedDate?.absentStudents || [],
        [attendanceForSelectedDate],
    );

    const isSelectedDateToday = useMemo(
        () => isSameDay(selectedDate, clearTime(new Date())),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedDate],
    );

    const canIssue = useMemo(() => canIssuePass(selectedDate), [selectedDate]);

    const absentStudentsList = useMemo<AbsentStudentRow[]>(
        () =>
            (attendanceForSelectedDate?.absentStudents || []).map((id: string | number) => {
                // id из базы АИС — строка, в записи посещаемости может лежать число
                const student = studentsList.find((item: any) => String(item.id) === String(id));
                const reasonId =
                    attendanceForSelectedDate?.absentReasons?.[String(id)] ??
                    attendanceForSelectedDate?.absentReasons?.[id] ??
                    "";
                const reason = absenceReason(reasonId);

                return {
                    id: String(id),
                    name: student?.name || "Неизвестный ученик",
                    reasonId,
                    reasonLabel: reasonId ? reason.label : "Причина не указана",
                    Icon: reason.Icon,
                    tone: reasonId ? reason.tone : ("neutral" as const),
                };
            }),
        [attendanceForSelectedDate, studentsList],
    );

    const presentCount = Math.max(studentsList.length - absentStudentsList.length, 0);
    const isAttendanceMarked = Boolean(attendanceForSelectedDate);

    const tabItems = tabs.map(tab => ({
        id: tab.id,
        label: tab.name,
        icon: tab.Icon,
        count:
            tab.id === "attendance"
                ? absentStudentsList.length
                : tab.id === "self-exit"
                    ? selfExits.length
                    : tab.id === "violations"
                        ? todayViolations.length
                        : tab.id === "schoolRecord"
                            ? schoolRecords.length
                            : authorizations.length,
    }));

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-full bg-bg">
                <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
                    <Skeleton height={56} radius="card" />
                    <Skeleton height={48} radius="control" />
                    <Skeleton height={92} radius="card" />
                    <Skeleton height={200} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;

    // Рабочий экран — отдельный раздел доступа: учителю можно закрыть его,
    // оставив, например, только аналитику.
    if (!accessLoading && !can("myClass")) return <NoAccess title="Нет доступа к разделу «Мой класс»" />;

    /* ------------------ Экран для сотрудника без классов ------------------ */
    if (!showWorkInterface) {
        return (
            <div className="min-h-full bg-bg">
                <main className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
                    <ProfileMenu
                        userName={safeFormatShortName(session.user.name)}
                        userEmail={session.user.email ?? null}
                        onLogout={() => void handleLogout()}
                        variant="full"
                    />

                    <Card padding="md" className="text-center">
                        <span
                            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full surface-accent bg-accent-solid text-accent-fg"
                            aria-hidden
                        >
                            <Sparkles size={24} />
                        </span>
                        <h1 className="mt-3 text-lg font-semibold text-fg">Электронные сервисы школы</h1>
                        <p className="mt-1 text-sm text-fg-muted">
                            Пропуска, нарушения, посещаемость и внутришкольный учёт в одном месте
                        </p>
                    </Card>

                    <Card title="Что умеет система" padding="none">
                        <List className="rounded-none border-0">
                            {[
                                {
                                    Icon: FileText,
                                    title: "Пропуска",
                                    description: "Оформление выхода ученика с причиной и временем",
                                },
                                {
                                    Icon: CheckCircle,
                                    title: "Посещаемость",
                                    description: "Ежедневная отметка присутствия с причинами отсутствия",
                                },
                                {
                                    Icon: AlertTriangle,
                                    title: "Нарушения",
                                    description: "Форма одежды, опоздания, телефон и другие замечания",
                                },
                                {
                                    Icon: ShieldAlert,
                                    title: "ВШУ",
                                    description: "Учёт учеников на внутришкольном учёте",
                                },
                            ].map(item => (
                                <li key={item.title}>
                                    <ListItem
                                        leading={item.Icon}
                                        title={item.title}
                                        subtitle={item.description}
                                        density="compact"
                                    />
                                </li>
                            ))}
                        </List>
                    </Card>

                    <Card title="Нужен доступ к классу" padding="md" className="text-center">
                        <p className="flex items-center justify-center gap-1.5 text-sm text-fg-muted">
                            <Info size={14} aria-hidden />
                            Обратитесь к администратору системы
                        </p>
                        <p className="mt-1 text-xs text-fg-subtle">
                            После назначения классным руководителем здесь появятся ваши классы
                        </p>
                    </Card>
                </main>


            </div>
        );
    }

    /* ----------------------------- Рабочий экран ----------------------------- */
    return (
        <div className="min-h-full bg-bg pb-24 md:pb-8">
            {/* Мобильный хэдер закреплён сверху страницы, а не внутри контента */}
            <MobilePageHeader
                title="Мой класс"
                userName={safeFormatShortName(session.user.name)}
                userEmail={session.user.email ?? null}
                roles={roles}
                onLogout={() => void handleLogout()}
            />

            <main className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
                {/* Десктоп: профиль и переход к сервисам, как раньше */}
                <div className="sticky top-0 z-20 -mx-4 hidden border-b border-border bg-bg/95 px-4 py-2 backdrop-blur-sm md:block">
                    <div className="flex items-center justify-between gap-2">
                        <ProfileMenu
                            userName={safeFormatShortName(session.user.name)}
                            userEmail={session.user.email ?? null}
                            onLogout={() => void handleLogout()}
                            variant="full"
                        />
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-fg-subtle">
                                {isClassTeacher ? "Классный руководитель" : "Преподаватель"}
                            </span>
                            <Link
                                href="/"
                                className="inline-flex items-center gap-1 rounded-control border border-dashed border-border px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                                aria-label="Все сервисы"
                            >
                                <ArrowLeft size={14} aria-hidden />
                                <span className="hidden sm:inline">Сервисы</span>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Класс */}
                <ClassSelector
                    selectedClass={selectedClass}
                    onClassChange={handleClassChange}
                    classes={classes}
                    currentTeacherId={session.user?.id}
                />

                {/* Мобильный: вкладки в раскрывающемся меню */}
                <div ref={tabMenuRef} className="relative md:hidden">
                    <Button
                        fullWidth
                        variant="secondary"
                        onClick={() => setIsTabMenuOpen(open => !open)}
                        aria-expanded={isTabMenuOpen}
                        rightIcon={isTabMenuOpen ? ChevronUp : ChevronDown}
                    >
                        Меню · {tabItems.find(item => item.id === activeTab)?.label ?? "Главная"}
                    </Button>

                    {isTabMenuOpen && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-3xl border border-border bg-surface p-1.5 shadow-raised">
                            {tabItems.map(item => {
                                const TabIcon = item.icon;
                                const selected = item.id === activeTab;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveTab(item.id);
                                            setIsTabMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-left text-sm transition-colors ${
                                            selected
                                                ? "bg-accent-soft text-accent-text"
                                                : "text-fg hover:bg-surface-hover"
                                        }`}
                                    >
                                        {TabIcon && <TabIcon size={18} aria-hidden />}
                                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                        {typeof item.count === "number" && item.count > 0 && (
                                            <span className="shrink-0 text-xs text-fg-subtle">{item.count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Десктоп: привычные вкладки */}
                <div className="hidden md:block">
                    <Tabs
                        variant="scrollable"
                        value={activeTab}
                        onChange={setActiveTab}
                        items={tabItems}
                        ariaLabel="Разделы класса"
                    />
                </div>

                {/* Календарь — только на «Главной» */}
                {activeTab === "attendance" && (
                    <WeekListScrollable selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
                )}

                {/* -------------------------- Посещаемость -------------------------- */}
                {activeTab === "attendance" && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {isSelectedDateToday && (
                                <Button
                                    className="flex-1"
                                    leftIcon={CheckCircle}
                                    onClick={() => setIsAttendanceModalOpen(true)}
                                >
                                    Отметить присутствие
                                </Button>
                            )}
                            {canIssue && (
                                <Button
                                    className="flex-1"
                                    variant="secondary"
                                    leftIcon={PenSquare}
                                    onClick={() => setIsPassModalOpen(true)}
                                >
                                    Выписать пропуск
                                </Button>
                            )}
                        </div>

                        {!isAttendanceMarked && isSelectedDateToday && (
                            <div className="flex items-start gap-2 rounded-control border border-dashed border-warning/50 bg-warning-soft px-3 py-2">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                                <p className="text-xs text-fg">
                                    Посещаемость на сегодня ещё не отмечена. Это займёт меньше минуты.
                                </p>
                            </div>
                        )}

                        {isAttendanceMarked ? (
                            <>
                                {absentStudentsList.length === 0 ? (
                                    <EmptyState
                                        icon={CheckCircle}
                                        title={`Все присутствуют · ${studentsList.length} из ${studentsList.length}`}
                                        description="Отсутствующих в этот день нет"
                                        compact
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2 px-1">
                                            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                                Отсутствуют
                                            </p>
                                            <span className="text-xs text-fg-subtle">
                                                {absentStudentsList.length} из {studentsList.length}
                                            </span>
                                        </div>
                                        <Card padding="none">
                                        <List className="rounded-none border-0">
                                            {absentStudentsList.map(student => (
                                                <li key={student.id}>
                                                    <ListItem
                                                        leading={student.Icon}
                                                        title={student.name}
                                                        trailing="badge"
                                                        trailingContent={
                                                            <Badge tone={student.tone}>{student.reasonLabel}</Badge>
                                                        }
                                                    />
                                                </li>
                                            ))}
                                        </List>
                                    </Card>
                                    </div>
                                )}
                            </>
                        ) : (
                            <EmptyState
                                title="Отметки за этот день нет"
                                description={
                                    isSelectedDateToday
                                        ? "Нажмите «Отметить присутствие», чтобы отметить класс"
                                        : "Выбран прошедший день без отметки"
                                }
                                compact
                            />
                        )}

                    </div>
                )}

                {/* Нарушения за выбранный день — на главной вкладке, с отработкой */}
                {activeTab === "attendance" && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                {isSelectedDateToday ? "Нарушения за сегодня" : `Нарушения за ${formatDateLocal(selectedDate)}`}
                            </p>
                            <span className="text-xs text-fg-subtle">{todayViolations.length}</span>
                        </div>

                        <ViolationAccordion
                            items={todayViolations}
                            isLoading={isLoadingViolations}
                            canResolve={isClassTeacher}
                            onResolve={violation => setResolveTargets([violation])}
                            emptyTitle={
                                isSelectedDateToday ? "Сегодня нарушений нет" : "Нарушений за выбранную дату нет"
                            }
                        />
                    </div>
                )}

                {/* Пропуска за выбранный день — после нарушений */}
                {activeTab === "attendance" && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Пропуска
                            </p>
                            <span className="text-xs text-fg-subtle">{passesForSelectedDate.length}</span>
                        </div>

                        {passesForSelectedDate.length === 0 ? (
                            <EmptyState
                                title="Пропусков нет"
                                description="На этот день пропуска не оформляли"
                                compact
                            />
                        ) : (
                            <Card padding="none">
                                <List className="rounded-none border-0">
                                    {passesForSelectedDate.map(pass => {
                                        const canDelete = canDeletePass(new Date(pass.date));
                                        const names = (pass.students ?? [])
                                            .map((student: any) => student.name)
                                            .join(", ");

                                        return (
                                            <li key={pass.id}>
                                                <ListItem
                                                    leading={Clock}
                                                    title={`Выход в ${pass.exitTime}`}
                                                    subtitle={names || "Ученики не указаны"}
                                                    meta={pass.reason || undefined}
                                                    trailing={canDelete ? "action" : "none"}
                                                    actionIcon={Trash2}
                                                    actionTone="danger"
                                                    actionLabel={`Удалить пропуск на ${pass.exitTime}`}
                                                    onActionClick={() => void deletePass(pass.id, pass.date)}
                                                />
                                            </li>
                                        );
                                    })}
                                </List>
                            </Card>
                        )}
                    </div>
                )}

                {/* --------------------------- Самовыходы --------------------------- */}
                {activeTab === "self-exit" && (
                    <div className="space-y-3">
                        <Button fullWidth leftIcon={Plus} onClick={() => setIsSelfExitModalOpen(true)}>
                            Добавить самовыход
                        </Button>

                        {selfExits.length === 0 ? (
                            <EmptyState
                                icon={UserCheck}
                                title="Нет активных самовыходов"
                                description="Самовыход разрешает ученику уходить домой самостоятельно"
                            />
                        ) : (
                            <List>
                                {selfExits.map(item => (
                                    <li key={item.id}>
                                        <ListItem
                                            leading={UserCheck}
                                            title={item.studentName}
                                            subtitle={`${formatDateRu(item.startDate)} — ${formatDateRu(item.endDate)}`}
                                            meta={item.reason || undefined}
                                            trailing="action"
                                            actionIcon={Trash2}
                                            actionTone="danger"
                                            actionLabel={`Отменить самовыход: ${item.studentName}`}
                                            onActionClick={() =>
                                                setPendingSelfExit({ id: item.id, studentName: item.studentName })
                                            }
                                        />
                                    </li>
                                ))}
                            </List>
                        )}
                    </div>
                )}

                {/* ---------------------------- Нарушения --------------------------- */}
                {activeTab === "violations" && (
                    <div className="space-y-3">
                        <Button fullWidth leftIcon={Plus} onClick={() => setIsViolationModalOpen(true)}>
                            Добавить нарушение
                        </Button>

                        <SearchInput
                            value={classSearch}
                            onChange={setClassSearch}
                            placeholder="Фамилия ученика"
                            label="Поиск"
                        />

                        <div className="flex flex-wrap items-center gap-1.5">
                            {(
                                [
                                    { id: "all", label: "Все" },
                                    { id: "today", label: "Сегодня" },
                                    { id: "week", label: "Неделя" },
                                    { id: "month", label: "Месяц" },
                                ] as const
                            ).map(item => (
                                <Chip
                                    key={item.id}
                                    selected={classRange === item.id}
                                    onClick={() => setClassRange(item.id)}
                                >
                                    {item.label}
                                </Chip>
                            ))}
                        </div>

                        <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Все нарушения класса
                            </p>
                            <span className="text-xs text-fg-subtle">{classTotal} всего</span>
                        </div>

                        <ViolationAccordion
                            items={classViolations}
                            isLoading={isLoadingClassViolations}
                            canResolve={isClassTeacher}
                            onResolve={violation => setResolveTargets([violation])}
                            emptyTitle="Нарушений по классу нет"
                            emptyDescription={
                                classSearchQuery ? "Попробуйте другую фамилию" : "За выбранный период замечаний нет"
                            }
                        />

                        {classViolations.length < classTotal && (
                            <Button
                                fullWidth
                                variant="secondary"
                                loading={isLoadingMore}
                                onClick={() => {
                                    if (!selectedClass) return;
                                    void loadClassViolations(
                                        selectedClass.name,
                                        classRange,
                                        classSearchQuery,
                                        classPage + 1,
                                        true,
                                    );
                                }}
                            >
                                Показать ещё
                            </Button>
                        )}
                    </div>
                )}

                                {/* ------------------------------- ВШУ ------------------------------ */}
                {activeTab === "schoolRecord" && (
                    <div className="space-y-3">
                        {isLoadingSchoolRecords ? (
                            <InlineLoading label="Загружаем учеников на учёте…" />
                        ) : schoolRecords.length === 0 ? (
                            <EmptyState
                                icon={ShieldAlert}
                                title="На учёте никого нет"
                                description={`В классе ${selectedClass?.name ?? ""} нет учеников на внутришкольном учёте`}
                            />
                        ) : (
                            <List>
                                {schoolRecords.map(record => (
                                    <li key={record.id}>
                                        <ListItem
                                            leading={ShieldAlert}
                                            title={record.studentName}
                                            subtitle={record.reason}
                                            meta={`Поставлен ${formatDateRu(record.registeredAt)}${
                                                record.registeredByName ? ` · ${record.registeredByName}` : ""
                                            }`}
                                            trailing="badge"
                                            trailingContent={
                                                record.plannedReleaseAt ? (
                                                    <Badge tone="warning">
                                                        план. снятие {formatDateRu(record.plannedReleaseAt)}
                                                    </Badge>
                                                ) : (
                                                    <Badge tone="neutral">на учёте</Badge>
                                                )
                                            }
                                        />
                                    </li>
                                ))}
                            </List>
                        )}
                    </div>
                )}

                {/* --------------------------- Доверенности ------------------------- */}
                {activeTab === "authorizations" && (
                    <div className="space-y-3">
                        <Button fullWidth leftIcon={Plus} onClick={() => setIsAuthorizationModalOpen(true)}>
                            Добавить доверенность
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-card border border-dashed border-border bg-surface p-3">
                                <p className="text-xs text-fg-subtle">Учеников в классе</p>
                                <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">
                                    {studentsList.length}
                                </p>
                            </div>
                            <div className="rounded-card border border-dashed border-border bg-surface p-3">
                                <p className="text-xs text-fg-subtle">С доверенностью</p>
                                <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">
                                    {new Set(authorizations.map(auth => String(auth.studentId))).size}
                                </p>
                            </div>
                        </div>

                        <Tabs
                            value={authorizationTab}
                            onChange={id => setAuthorizationTab(id as "active" | "archive")}
                            ariaLabel="Доверенности"
                            items={[
                                { id: "active", label: "Активные", count: authorizations.length },
                                { id: "archive", label: "Архив", count: archivedAuthorizations.length },
                            ]}
                        />

                        {isLoadingAuthorizations ? (
                            <InlineLoading label="Загружаем доверенности…" />
                        ) : authorizationTab === "active" ? (
                            authorizations.length === 0 ? (
                                <EmptyState
                                    icon={Shield}
                                    title="Нет активных доверенностей"
                                    description="Доверенность разрешает другому человеку забрать ребёнка из школы"
                                />
                            ) : (
                                <List>
                                    {authorizations.map(auth => (
                                        <li key={auth.id}>
                                            <ListItem
                                                leading={Shield}
                                                title={auth.studentName}
                                                subtitle={`Забирает: ${auth.trustedName} · ${auth.relation}`}
                                                meta={
                                                    [auth.phone, auth.comment].filter(Boolean).join(" · ") || undefined
                                                }
                                                trailing="action"
                                                actionIcon={Trash2}
                                                actionTone="danger"
                                                actionLabel={`Отозвать доверенность: ${auth.studentName}`}
                                                onActionClick={() =>
                                                    setPendingRevoke({ id: auth.id, studentName: auth.studentName })
                                                }
                                            />
                                        </li>
                                    ))}
                                </List>
                            )
                        ) : archivedAuthorizations.length === 0 ? (
                            <EmptyState icon={Archive} title="Архив пуст" description="Отозванные доверенности появятся здесь" />
                        ) : (
                            <List>
                                {archivedAuthorizations.map(auth => (
                                    <li key={auth.id}>
                                        <ListItem
                                            leading={Archive}
                                            title={auth.studentName}
                                            subtitle={`Забирал: ${auth.trustedName} · ${auth.relation}`}
                                            meta={`Отозвана ${
                                                auth.revokedAt ? formatDateRu(auth.revokedAt) : "—"
                                            }${auth.revokedByName ? ` · ${auth.revokedByName}` : ""}`}
                                        />
                                    </li>
                                ))}
                            </List>
                        )}
                    </div>
                )}
            </main>


            {/* Отработка нарушения классным руководителем — отмечаем это флагом */}
            <ResolveViolationModal
                open={Boolean(resolveTargets)}
                onClose={() => setResolveTargets(null)}
                violations={resolveTargets ?? []}
                source="class_teacher"
                onDone={() => {
                    setResolveTargets(null);
                    if (selectedClass) {
                        void loadClassViolations(selectedClass.name, classRange, classSearchQuery, 1, false);

                        // Список «за сегодня» тоже обновляем — иначе статус менялся
                        // только после перезагрузки страницы
                        const dateStr = formatDateLocal(selectedDate);
                        void fetch(
                            `/api/violations?className=${encodeURIComponent(selectedClass.name)}&date=${dateStr}&pageSize=100&stats=false`,
                        )
                            .then(response => (response.ok ? response.json() : null))
                            .then(data => {
                                const rows = Array.isArray(data)
                                    ? data
                                    : Array.isArray(data?.violations)
                                        ? data.violations
                                        : [];
                                setTodayViolations(rows);
                            })
                            .catch(error => console.error("Error refreshing today violations:", error));
                    }
                }}
            />

            {/* -------------------------------- Модалки ------------------------------- */}
            <PassModal
                isOpen={isPassModalOpen}
                onClose={() => setIsPassModalOpen(false)}
                selectedDate={selectedDate}
                onSubmit={handleSubmitPass}
                existingPasses={passesForSelectedDate}
                absentStudentsOnDate={absentStudentsOnSelectedDate}
                studentsList={studentsList}
            />

            <AttendanceModal
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                selectedDate={selectedDate}
                onSubmit={handleSubmitAttendance}
                existingAttendance={attendanceForSelectedDate}
                studentsList={studentsList}
            />

            <ViolationModal
                isOpen={isViolationModalOpen}
                onClose={() => setIsViolationModalOpen(false)}
                onSubmit={handleSubmitViolation}
            />

            {showJuniorFeatures && (
                <>
                    <SelfExitModal
                        isOpen={isSelfExitModalOpen}
                        onClose={() => setIsSelfExitModalOpen(false)}
                        onSubmit={handleSubmitSelfExit}
                        studentsList={studentsList}
                    />

                    <AuthorizationModal
                        isOpen={isAuthorizationModalOpen}
                        onClose={() => setIsAuthorizationModalOpen(false)}
                        onSubmit={handleSubmitAuthorization}
                        studentsList={studentsList}
                    />
                </>
            )}

            {/* Подтверждение отмены самовыхода */}
            <Modal
                open={Boolean(pendingSelfExit)}
                onClose={() => setPendingSelfExit(null)}
                title="Отменить самовыход?"
                description={pendingSelfExit?.studentName}
                size="sm"
                footer={
                    <ModalFooter
                        onCancel={() => setPendingSelfExit(null)}
                        onSubmit={() => {
                            const pending = pendingSelfExit;
                            setPendingSelfExit(null);
                            if (pending) void cancelSelfExit(pending.id, pending.studentName);
                        }}
                        submitLabel="Отменить самовыход"
                        tone="danger"
                    />
                }
            >
                <p className="text-sm text-fg-muted">
                    Ученик больше не сможет уходить домой самостоятельно — запись удалится.
                </p>
            </Modal>

            {/* Подтверждение отзыва доверенности */}
            <Modal
                open={Boolean(pendingRevoke)}
                onClose={() => setPendingRevoke(null)}
                title="Отозвать доверенность?"
                description={pendingRevoke?.studentName}
                size="sm"
                footer={
                    <ModalFooter
                        onCancel={() => setPendingRevoke(null)}
                        onSubmit={() => {
                            const pending = pendingRevoke;
                            setPendingRevoke(null);
                            if (pending) void revokeAuthorization(pending.id);
                        }}
                        submitLabel="Отозвать"
                        tone="danger"
                    />
                }
            >
                <p className="text-sm text-fg-muted">
                    Доверенность переместится в архив. Человек больше не сможет забрать ребёнка по этой доверенности.
                </p>
            </Modal>
        </div>
    );
}
