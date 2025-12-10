import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pkg from 'pg';
const { Pool } = pkg;

let db;
const isProduction = process.env.NODE_ENV === 'production';

// PostgreSQL Pool for production
let pgPool;

export async function initializeDatabase() {
    if (isProduction) {
        // Production: Use PostgreSQL
        // Try DATABASE_URL first, then construct from individual variables
        let databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
            // Construct from Zeabur's PostgreSQL environment variables
            const host = process.env.POSTGRES_HOST;
            const port = process.env.POSTGRES_PORT || '5432';
            const user = process.env.POSTGRES_USER;
            const password = process.env.POSTGRES_PASSWORD;
            const database = process.env.POSTGRES_DATABASE;

            if (host && user && password && database) {
                databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}`;
                console.log('Constructed DATABASE_URL from POSTGRES_* variables');
            } else {
                throw new Error('DATABASE_URL or POSTGRES_* environment variables are required in production');
            }
        }

        // Determine SSL configuration
        // Some PostgreSQL servers (like Zeabur) don't support SSL
        const sslConfig = process.env.DATABASE_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false;

        pgPool = new Pool({
            connectionString: databaseUrl,
            ssl: sslConfig
        });

        // Create tables for PostgreSQL
        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                avatar_url TEXT
            );

            CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                name TEXT,
                passcode TEXT,
                host TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                channel_id TEXT,
                sender TEXT,
                text TEXT,
                time TEXT,
                timestamp BIGINT
            );

            CREATE TABLE IF NOT EXISTS channel_invites (
                channel_id TEXT,
                username TEXT,
                invited_by TEXT,
                timestamp BIGINT,
                PRIMARY KEY (channel_id, username)
            );

            CREATE TABLE IF NOT EXISTS reactions (
                id SERIAL PRIMARY KEY,
                message_id INTEGER,
                channel_id TEXT,
                username TEXT,
                emoji TEXT,
                timestamp BIGINT,
                UNIQUE(message_id, username, emoji)
            );

            CREATE TABLE IF NOT EXISTS message_reads (
                message_id INTEGER,
                channel_id TEXT,
                username TEXT,
                read_at BIGINT,
                PRIMARY KEY (message_id, username)
            );
        `);

        // Seed initial channels if empty
        const channelsResult = await pgPool.query('SELECT * FROM channels');
        if (channelsResult.rows.length === 0) {
            const initialChannels = [
                { id: 'c1', name: 'General', passcode: null, host: 'system' },
                { id: 'c2', name: 'Standup', passcode: null, host: 'system' },
                { id: 'c3', name: 'Random', passcode: null, host: 'system' }
            ];
            for (const c of initialChannels) {
                await pgPool.query(
                    'INSERT INTO channels (id, name, passcode, host) VALUES ($1, $2, $3, $4)',
                    [c.id, c.name, c.passcode, c.host]
                );
            }
        }

        console.log("PostgreSQL Database initialized");

        // Create a wrapper to match SQLite API
        db = {
            run: async (sql, ...params) => {
                const pgSql = sql.replace(/\?/g, (_, i) => `$${params.findIndex((_, idx) => idx === i) + 1}`);
                let actualSql = pgSql;
                let paramIndex = 1;
                actualSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
                await pgPool.query(actualSql, params);
            },
            get: async (sql, ...params) => {
                let actualSql = sql;
                let paramIndex = 1;
                actualSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                const result = await pgPool.query(actualSql, params);
                return result.rows[0];
            },
            all: async (sql, ...params) => {
                let actualSql = sql;
                let paramIndex = 1;
                actualSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
                const result = await pgPool.query(actualSql, params);
                return result.rows;
            }
        };
    } else {
        // Development: Use SQLite
        db = await open({
            filename: 'chat.db',
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                avatar_url TEXT
            );

            CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                name TEXT,
                passcode TEXT,
                host TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT,
                sender TEXT,
                text TEXT,
                time TEXT,
                timestamp INTEGER
            );

            CREATE TABLE IF NOT EXISTS channel_invites (
                channel_id TEXT,
                username TEXT,
                invited_by TEXT,
                timestamp INTEGER,
                PRIMARY KEY (channel_id, username)
            );

            CREATE TABLE IF NOT EXISTS reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER,
                channel_id TEXT,
                username TEXT,
                emoji TEXT,
                timestamp INTEGER,
                UNIQUE(message_id, username, emoji)
            );

            CREATE TABLE IF NOT EXISTS message_reads (
                message_id INTEGER,
                channel_id TEXT,
                username TEXT,
                read_at INTEGER,
                PRIMARY KEY (message_id, username)
            );
        `);

        // Migration: Add avatar_url column if it doesn't exist
        try {
            await db.run('ALTER TABLE users ADD COLUMN avatar_url TEXT');
            console.log('Migration: Added avatar_url column to users table');
        } catch (e) {
            // Column already exists, ignore error
        }

        // Seed initial channels if empty
        const channels = await db.all('SELECT * FROM channels');
        if (channels.length === 0) {
            const initialChannels = [
                { id: 'c1', name: 'General', passcode: null, host: 'system' },
                { id: 'c2', name: 'Standup', passcode: null, host: 'system' },
                { id: 'c3', name: 'Random', passcode: null, host: 'system' }
            ];
            for (const c of initialChannels) {
                await db.run('INSERT INTO channels (id, name, passcode, host) VALUES (?, ?, ?, ?)',
                    c.id, c.name, c.passcode, c.host);
            }
        }

        console.log("SQLite Database initialized");
    }

    return db;
}

export function getDb() {
    if (!db) {
        throw new Error("Database not initialized. Call initializeDatabase first.");
    }
    return db;
}
