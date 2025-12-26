import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VideoCall from '../../components/VideoCall';
import { Socket } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        id: 'mock-socket-id'
    }
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
        getUserMedia: mockGetUserMedia
    }
});

describe('VideoCall Component', () => {
    let mockSocket: Partial<Socket>;
    let mockStream: MediaStream;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Mock socket
        mockSocket = {
            id: 'test-socket-id',
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        };

        // Mock media stream
        mockStream = {
            getTracks: vi.fn(() => [])
        } as unknown as MediaStream;

        mockGetUserMedia.mockResolvedValue(mockStream);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render video call overlay', () => {
        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        expect(screen.getByText('Leave Call')).toBeInTheDocument();
    });

    it('should show error when media devices not supported', () => {
        Object.defineProperty(navigator, 'mediaDevices', {
            writable: true,
            value: undefined
        });

        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        expect(screen.getByText(/Media devices not supported/)).toBeInTheDocument();
    });

    it('should show microphone icon for voice-only calls', () => {
        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={true}
            />
        );

        expect(screen.getByText('🎤')).toBeInTheDocument();
    });

    it('should call onClose when leave button is clicked', () => {
        const onClose = vi.fn();

        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={onClose}
                isVoiceOnly={false}
            />
        );

        const leaveButton = screen.getByText('Leave Call');
        fireEvent.click(leaveButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should emit join_video event on mount', async () => {
        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        await waitFor(() => {
            expect(mockSocket.emit).toHaveBeenCalledWith('join_video', 'test-channel');
        });
    });

    it('should show error when getUserMedia fails', async () => {
        mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Could not access media devices/)).toBeInTheDocument();
        });
    });

    it('should cleanup socket listeners on unmount', async () => {
        const { unmount } = render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        await waitFor(() => {
            expect(mockSocket.on).toHaveBeenCalled();
        });

        unmount();

        expect(mockSocket.off).toHaveBeenCalledWith('all_users');
        expect(mockSocket.off).toHaveBeenCalledWith('call_received');
        expect(mockSocket.off).toHaveBeenCalledWith('call_answered');
        expect(mockSocket.off).toHaveBeenCalledWith('ice_candidate_received');
    });

    it('should stop media tracks on unmount', async () => {
        const stopTrack = vi.fn();
        mockStream = {
            getTracks: vi.fn(() => [{ stop: stopTrack }])
        } as unknown as MediaStream;
        mockGetUserMedia.mockResolvedValue(mockStream);

        const { unmount } = render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        await waitFor(() => {
            expect(mockGetUserMedia).toHaveBeenCalled();
        });

        unmount();

        expect(stopTrack).toHaveBeenCalled();
    });

    it('should display "You" label for own video', async () => {
        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('You')).toBeInTheDocument();
        });
    });

    it('should handle all_users socket event', async () => {
        const mockOn = (event: string, callback: (data: any) => void) => {
            if (event === 'all_users') {
                // Simulate receiving all_users event
                setTimeout(() => {
                    callback(['user1', 'user2']);
                }, 0);
            }
        };
        mockSocket.on = mockOn;

        render(
            <VideoCall
                socket={mockSocket as Socket}
                channelId="test-channel"
                username="test-user"
                onClose={vi.fn()}
                isVoiceOnly={false}
            />
        );

        await waitFor(() => {
            expect(mockSocket.on).toHaveBeenCalledWith('all_users', expect.any(Function));
        });
    });
});