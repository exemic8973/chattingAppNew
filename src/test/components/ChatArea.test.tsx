import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatArea from '../../components/ChatArea';
import { I18nProvider } from '../../i18n/I18nContext';
import type { Message as MessageType } from '../../types';

// Mock i18n context
const mockTranslations = {
    'chat.loadingHistory': 'Loading more messages...',
    'chat.typing': 'is typing',
    'chat.attachImage': 'Attach image',
    'chat.typeMessage': 'Type a message...',
    'chat.send': 'Send'
};

const renderWithI18n = (ui: React.ReactNode) => {
    return render(
        <I18nProvider>
            {ui}
        </I18nProvider>
    );
};

describe('ChatArea Component', () => {
    const mockOnSendMessage = vi.fn();
    const mockOnTyping = vi.fn();
    const mockOnStopTyping = vi.fn();
    const mockOnLoadMore = vi.fn();
    const mockOnAddReaction = vi.fn();
    const mockOnRemoveReaction = vi.fn();
    const mockOnDelete = vi.fn();
    const mockOnEdit = vi.fn();

    const mockMessages: MessageType[] = [
        {
            id: 1,
            text: 'Hello world',
            sender: 'user1',
            time: '10:00',
            isOwn: false,
            reactions: []
        },
        {
            id: 2,
            text: 'Hi there!',
            sender: 'current-user',
            time: '10:01',
            isOwn: true,
            reactions: []
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render messages list', () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('should render message input', () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
        expect(screen.getByText('Send')).toBeInTheDocument();
    });

    it('should send message when send button is clicked', () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        const input = screen.getByPlaceholderText('Type a message...');
        const sendButton = screen.getByText('Send');

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.click(sendButton);

        expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
        expect(input).toHaveValue('');
    });

    it('should send message when Enter key is pressed', () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        const input = screen.getByPlaceholderText('Type a message...');

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should call onTyping when user types', async () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                onTyping={mockOnTyping}
                onStopTyping={mockOnStopTyping}
                currentUser="current-user"
            />
        );

        const input = screen.getByPlaceholderText('Type a message...');

        fireEvent.change(input, { target: { value: 'T' } });

        expect(mockOnTyping).toHaveBeenCalled();
    });

    it('should call onStopTyping after 2 seconds of inactivity', async () => {
        vi.useFakeTimers();

        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                onTyping={mockOnTyping}
                onStopTyping={mockOnStopTyping}
                currentUser="current-user"
            />
        );

        const input = screen.getByPlaceholderText('Type a message...');

        fireEvent.change(input, { target: { value: 'T' } });
        expect(mockOnTyping).toHaveBeenCalled();

        vi.advanceTimersByTime(2000);

        expect(mockOnStopTyping).toHaveBeenCalled();

        vi.useRealTimers();
    });

    it('should display typing indicator', () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                typingUsers={['user1', 'user2']}
                currentUser="current-user"
            />
        );

        expect(screen.getByText(/user1, user2.*is typing/)).toBeInTheDocument();
    });

    it('should show loading indicator when loading more messages', () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                onLoadMore={mockOnLoadMore}
                currentUser="current-user"
            />
        );

        const messagesList = screen.querySelector('.messages-list');
        if (messagesList) {
            fireEvent.scroll(messagesList, { target: { scrollTop: 0 } });
        }

        expect(screen.getByText('Loading more messages...')).toBeInTheDocument();
    });

    it('should handle file upload for images', async () => {
        const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        const mockResponse = { url: '/uploads/test.jpg' };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        const attachButton = screen.getByText('📎');
        fireEvent.click(attachButton);

        const fileInput = screen.querySelector('input[type="file"]');
        if (fileInput) {
            fireEvent.change(fileInput, { target: { files: [mockFile] } });
        }

        await waitFor(() => {
            expect(mockOnSendMessage).toHaveBeenCalledWith('![test.jpg](/uploads/test.jpg)');
        });
    });

    it('should handle file upload for non-image files', async () => {
        const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
        const mockResponse = { url: '/uploads/test.pdf' };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        const attachButton = screen.getByText('📎');
        fireEvent.click(attachButton);

        const fileInput = screen.querySelector('input[type="file"]');
        if (fileInput) {
            fireEvent.change(fileInput, { target: { files: [mockFile] } });
        }

        await waitFor(() => {
            expect(mockOnSendMessage).toHaveBeenCalledWith('📎 [test.pdf](/uploads/test.pdf)');
        });
    });

    it('should not send empty messages', () => {
        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        const sendButton = screen.getByText('Send');
        fireEvent.click(sendButton);

        expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('should show loading spinner when uploading file', async () => {
        const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

        (global.fetch as any).mockImplementation(() => new Promise(() => {}));

        renderWithI18n(
            <ChatArea
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                currentUser="current-user"
            />
        );

        const attachButton = screen.getByText('📎');
        fireEvent.click(attachButton);

        const fileInput = screen.querySelector('input[type="file"]');
        if (fileInput) {
            fireEvent.change(fileInput, { target: { files: [mockFile] } });
        }

        await waitFor(() => {
            expect(screen.getByText('⏳')).toBeInTheDocument();
        });
    });

    it('should pass all message props to Message components', () => {
        const messageWithReactions: MessageType = {
            id: 1,
            text: 'Hello world',
            sender: 'user1',
            time: '10:00',
            isOwn: false,
            reactions: [
                { emoji: '👍', username: 'user2', timestamp: Date.now() }
            ]
        };

        renderWithI18n(
            <ChatArea
                messages={[messageWithReactions]}
                onSendMessage={mockOnSendMessage}
                onAddReaction={mockOnAddReaction}
                onRemoveReaction={mockOnRemoveReaction}
                onDelete={mockOnDelete}
                onEdit={mockOnEdit}
                currentUser="current-user"
            />
        );

        expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
});