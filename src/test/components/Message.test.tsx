import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Message from '@/components/Message'
import { I18nProvider } from '@/i18n/I18nContext'
import type { Reaction } from '@/types'

describe('Message Component', () => {
  const mockProps = {
    text: 'Hello world',
    isOwn: false,
    sender: 'TestUser',
    time: '12:00',
    messageId: 1,
    reactions: [],
    currentUser: 'CurrentUser',
    onAddReaction: vi.fn(),
    onRemoveReaction: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
  }

  const renderWithI18n = (component: React.ReactElement) => {
    return render(
      <I18nProvider>
        {component}
      </I18nProvider>
    )
  }

  it('renders message correctly', () => {
    render(
      <I18nProvider>
        <Message {...mockProps} />
      </I18nProvider>
    )
    
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
    expect(screen.getByText('12:00')).toBeInTheDocument()
  })

  it('renders own message with correct styling', () => {
    renderWithI18n(<Message {...mockProps} isOwn={true} />)
    
    const messageContainer = screen.getByText('Hello world').closest('.message')
    expect(messageContainer).toHaveClass('own')
  })

  it('renders system message correctly', () => {
    const systemProps = { ...mockProps, sender: 'System', isSystem: true }
    
    renderWithI18n(<Message {...systemProps} />)
    
    expect(screen.getByText('ℹ️')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('12:00')).toBeInTheDocument()
  })

  it('displays reactions correctly', () => {
    const reactions: Reaction[] = [
      { emoji: '👍', username: 'User1' },
      { emoji: '👍', username: 'CurrentUser' },
      { emoji: '❤️', username: 'User2' },
    ]
    
    renderWithI18n(<Message {...mockProps} reactions={reactions} />)
    
    expect(screen.getByText('👍')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Count for 👍
    expect(screen.getByText('❤️')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // Count for ❤️
  })

  it('shows edit and delete buttons for own messages on hover', async () => {
    const user = userEvent.setup()
    renderWithI18n(<Message {...mockProps} isOwn={true} />)
    
    const messageContainer = screen.getByText('Hello world').closest('.message')
    
    await user.hover(messageContainer!)
    
    // Wait for the menu to appear
    await waitFor(() => {
      expect(screen.getByTitle('Edit')).toBeInTheDocument()
      expect(screen.getByTitle('Delete')).toBeInTheDocument()
    })
  })

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup()
    renderWithI18n(<Message {...mockProps} isOwn={true} />)
    
    const messageContainer = screen.getByText('Hello world').closest('.message')
    await user.hover(messageContainer!)
    
    // Wait for the menu to appear
    await waitFor(() => {
      expect(screen.getByTitle('Delete')).toBeInTheDocument()
    })
    
    // Mock window.confirm
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)
    
    const deleteButton = screen.getByTitle('Delete')
    await user.click(deleteButton)
    
    expect(mockProps.onDelete).toHaveBeenCalledWith(1)
    
    // Restore original confirm
    window.confirm = originalConfirm
  })

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup()
    renderWithI18n(<Message {...mockProps} isOwn={true} />)
    
    const messageContainer = screen.getByText('Hello world').closest('.message')
    await user.hover(messageContainer!)
    
    // Wait for the menu to appear
    await waitFor(() => {
      expect(screen.getByTitle('Edit')).toBeInTheDocument()
    })
    
    const editButton = screen.getByTitle('Edit')
    await user.click(editButton)
    
    // Wait for the input to appear
    await waitFor(() => {
      expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument()
    })
  })

  it('shows emoji picker when reaction button is clicked', async () => {
    const user = userEvent.setup()
    renderWithI18n(<Message {...mockProps} />)
    
    const addButton = screen.getByTitle('Add reaction')
    await user.click(addButton)
    
    // Check if quick emojis are shown
    expect(screen.getByText('👍')).toBeInTheDocument()
    expect(screen.getByText('❤️')).toBeInTheDocument()
    expect(screen.getByText('😂')).toBeInTheDocument()
  })

  it('calls onAddReaction when emoji is selected', async () => {
    const user = userEvent.setup()
    renderWithI18n(<Message {...mockProps} />)
    
    const addButton = screen.getByTitle('Add reaction')
    await user.click(addButton)
    
    const thumbsUpEmoji = screen.getByText('👍')
    await user.click(thumbsUpEmoji)
    
    expect(mockProps.onAddReaction).toHaveBeenCalledWith(1, '👍')
  })

  it('calls onRemoveReaction when user clicks their own reaction', async () => {
    const user = userEvent.setup()
    const reactions: Reaction[] = [
      { emoji: '👍', username: 'CurrentUser' },
    ]
    
    renderWithI18n(<Message {...mockProps} reactions={reactions} />)
    
    const reactionButton = screen.getByText('👍')
    await user.click(reactionButton)
    
    expect(mockProps.onRemoveReaction).toHaveBeenCalledWith(1, '👍')
  })

  it('submits edit when Enter key is pressed in edit mode', async () => {
    const user = userEvent.setup()
    renderWithI18n(<Message {...mockProps} isOwn={true} />)
    
    const messageContainer = screen.getByText('Hello world').closest('.message')
    await user.hover(messageContainer!)
    
    // Wait for the menu to appear
    await waitFor(() => {
      expect(screen.getByTitle('Edit')).toBeInTheDocument()
    })
    
    const editButton = screen.getByTitle('Edit')
    await user.click(editButton)
    
    // Wait for the input to appear
    await waitFor(() => {
      expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument()
    })
    
    const input = screen.getByDisplayValue('Hello world')
    await user.clear(input)
    await user.type(input, 'Updated message')
    await user.keyboard('{Enter}')
    
    expect(mockProps.onEdit).toHaveBeenCalledWith(1, 'Updated message')
  })

  it('highlights message when highlighted prop is true', () => {
    renderWithI18n(<Message {...mockProps} highlighted={true} />)
    
    const messageContainer = screen.getByText('Hello world').closest('.message')
    expect(messageContainer).toHaveStyle({
      backgroundColor: 'rgba(108, 99, 255, 0.2)'
    })
  })
})