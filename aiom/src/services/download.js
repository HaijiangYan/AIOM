#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const experimentDir = process.cwd();
// Parse command line arguments
// const tableName = process.argv.slice(2)[0];

class DataDownloader {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT),
        });
    }

    async downloadTable(tableName, outputDir = './db_export') {
        try {
            console.log(`📥 Downloading table: ${tableName}`);
            
            // Create downloads directory
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Get table data
            const result = await this.pool.query(`SELECT * FROM ${tableName}`);
            
            if (result.rows.length === 0) {
                console.log(`⚠️ Table ${tableName} is empty`);
                return null;
            }

            // Generate filename with timestamp
            // const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            // const filename = `${tableName}_${timestamp}.csv`;
            const filename = `${tableName}.csv`;
            const filepath = path.join(outputDir, filename);

            // Get column headers
            const headers = Object.keys(result.rows[0]).map(key => ({
                id: key,
                title: key
            }));

            // Create CSV writer
            const csvWriter = createCsvWriter({
                path: filepath,
                header: headers
            });

            // Write data to CSV
            await csvWriter.writeRecords(result.rows);
            
            console.log(`✅ Downloaded ${result.rows.length} rows to: ${filepath}`);
            return filepath;

        } catch (error) {
            if (error.code === '42P01') {
                console.error(`❌ Table '${tableName}' does not exist`);
            } else {
                console.error(`❌ Error downloading ${tableName}:`, error.message);
            }
            throw error;
        }
    }

    async listTables() {
        try {
            const result = await this.pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            `);
            return result.rows.map(row => row.table_name);
        } catch (error) {
            console.error('❌ Error listing tables:', error.message);
            throw error;
        }
    }

    async downloadAllTables(outputDir = './downloads') {
        try {
            const tables = await this.listTables();
            console.log(`📋 Found ${tables.length} tables: ${tables.join(', ')}`);

            const downloadedFiles = [];
            
            for (const table of tables) {
                try {
                    const filepath = await this.downloadTable(table, outputDir);
                    if (filepath) downloadedFiles.push(filepath);
                } catch (error) {
                    console.warn(`⚠️ Skipped table ${table}: ${error.message}`);
                }
            }
            console.log(`\n✅ Download complete! ${downloadedFiles.length} files saved to: ${outputDir}`);
            return downloadedFiles;

        } catch (error) {
            console.error('❌ Error downloading all tables:', error.message);
            throw error;
        }
    }
    async close() {
        await this.pool.end();
    }
}

// async function main() {
//     const downloader = new DataDownloader();
//     try {
//         if (!tableName) {
//             // Show available tables and usage
//             const tables = await downloader.listTables();
//             console.log('📊 Available tables:');
//             tables.forEach(table => console.log(`  - ${table}`));
//             console.log('\n📝 Usage:');
//             console.log('  npm run download participants    # Download participants table');
//             console.log('  npm run download all           # Download all tables');
//             return;
//         } else if (tableName === 'all') {
//             await downloader.downloadAllTables(experimentDir + '/downloads');
//         } else {
//             await downloader.downloadTable(tableName, experimentDir + '/downloads');
//         }
//     } catch (error) {
//         console.error('❌ Download failed:', error.message);
//         console.error('💡 Make sure your database is running and .env is configured correctly');
//         process.exit(1);
//     } finally {
//         await downloader.close();
//     }
// }

module.exports = DataDownloader;