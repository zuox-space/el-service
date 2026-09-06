const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Настройки подключения к БД
const config = {
    host: '192.168.20.61',
    user: 'pass_system',
    password: 'ktSXPOr2ekCGS4cr',
    database: 'students',
    port: 3306
};

async function connectAndExport() {
    let connection;

    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Подключение к БД установлено');

        // SQL запрос с CONCAT - сначала фамилия, потом имя
        const query = `
            SELECT 
                aisId,
                CONCAT(lastName, ' ', firstName) AS name,
                className 
            FROM students 
            WHERE archive = 0
            ORDER BY aisId
        `;

        const [results] = await connection.execute(query);

        console.log(`\n📊 Найдено записей: ${results.length}`);
        console.log('-'.repeat(70));
        results.forEach(row => {
            console.log(`ID: ${row.aisId}, Имя: ${row.name}, Класс: ${row.className}`);
        });

        // Экспорт в CSV
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `students_export_${timestamp}.csv`;

        let csvContent = 'aisId,name,className\n';
        results.forEach(row => {
            csvContent += `${row.aisId},"${row.name}","${row.className}"\n`;
        });

        fs.writeFileSync(filename, csvContent, 'utf8');
        console.log(`\n💾 Данные экспортированы в CSV: ${filename}`);

        // Экспорт в JSON
        const jsonFilename = `students_export_${timestamp}.json`;
        fs.writeFileSync(jsonFilename, JSON.stringify(results, null, 2), 'utf8');
        console.log(`💾 Данные экспортированы в JSON: ${jsonFilename}`);

        return results;

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        return null;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔒 Соединение закрыто');
        }
    }
}

connectAndExport();