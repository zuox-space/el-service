// types/student.ts
export interface Student {
    aisId: number;
    name: string;
    className: string;
}

export interface StudentFull extends Student {
    firstName: string;
    lastName: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    count?: number;
    error?: string;
}

export interface StudentsResponse extends ApiResponse<Student[]> {
    count: number;
}

export interface StudentResponse extends ApiResponse<Student> { }

export interface SearchParams {
    q: string;
    limit?: number;
}