import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

export async function initializeDatabase() {
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

    console.log("Database initialized");
    return db;
}

export function getDb() {
    if (!db) {
        throw new Error("Database not initialized. Call initializeDatabase first.");
    }
    return db;
}
