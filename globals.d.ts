// src/globals.d.ts или app/globals.d.ts
declare module "*.css" {
    const content: { [className: string]: string };
    export default content;
}

// Или для глобальных CSS файлов
declare module "./globals.css" {
    const content: any;
    export default content;
}