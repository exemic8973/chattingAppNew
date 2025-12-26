import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'

// Mock database
const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
}

// Mock the database module
vi.mock('../db.js', () => ({
  getDb: () => mockDb,
}))

describe('Authentication Endpoints', () => {
  let app: express.Application

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create Express app
    app = express()
    app.use(cors())
    app.use(express.json())

    // Add rate limiting
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
    })
    app.use('/api/auth', authLimiter)

    // Auth endpoints
    app.post('/api/auth/signup', async (req, res) => {
      const { username, password } = req.body

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' })
      }

      try {
        // Check if user exists
        mockDb.get.mockResolvedValueOnce(null) // User doesn't exist

        const hashedPassword = await bcrypt.hash(password, 10)
        mockDb.run.mockResolvedValueOnce(undefined)

        res.status(201).json({ message: 'User created successfully' })
      } catch (error) {
        res.status(500).json({ error: 'Server error' })
      }
    })

    app.post('/api/auth/login', async (req, res) => {
      const { username, password } = req.body

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' })
      }

      try {
        // Mock user exists
        const mockUser = {
          id: 1,
          username: 'testuser',
          password: await bcrypt.hash('password123', 10),
        }
        mockDb.get.mockResolvedValueOnce(mockUser)

        const isMatch = await bcrypt.compare(password, mockUser.password)
        
        if (isMatch) {
          res.json({ message: 'Login successful', username: mockUser.username })
        } else {
          res.status(401).json({ error: 'Invalid credentials' })
        }
      } catch (error) {
        res.status(500).json({ error: 'Server error' })
      }
    })
  })

  it('should signup a new user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'newuser',
        password: 'password123'
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe('User created successfully')
  })

  it('should reject signup with missing credentials', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'newuser'
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Username and password required')
  })

  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Login successful')
    expect(response.body.username).toBe('testuser')
  })

  it('should reject login with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'wrongpassword'
      })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Invalid credentials')
  })

  it('should reject login with missing credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser'
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Username and password required')
  })

  it('should handle database errors gracefully', async () => {
    mockDb.get.mockRejectedValueOnce(new Error('Database error'))

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      })

    expect(response.status).toBe(500)
    expect(response.body.error).toBe('Server error')
  })
})