export const initialData = {
    teams: [
        {
            id: 1,
            name: 'Engineering',
            channels: [
                {
                    id: 'c1', name: 'General', messages: [
                        { id: 1, text: 'Welcome to the Engineering team!', sender: 'System', time: '9:00 AM', isOwn: false },
                        { id: 2, text: 'Hey everyone, ready for the sprint?', sender: 'Alice', time: '9:05 AM', isOwn: false },
                        { id: 3, text: 'Yes, let\'s do this!', sender: 'Bob', time: '9:06 AM', isOwn: true },
                    ]
                },
                {
                    id: 'c2', name: 'Standup', messages: [
                        { id: 1, text: 'Standup in 5 mins', sender: 'Alice', time: '10:00 AM', isOwn: false },
                    ]
                },
                { id: 'c3', name: 'Random', messages: [] }
            ]
        },
        {
            id: 2,
            name: 'Design',
            channels: [
                { id: 'c4', name: 'General', messages: [] },
                {
                    id: 'c5', name: 'Inspiration', messages: [
                        { id: 1, text: 'Check out this new UI kit', sender: 'Charlie', time: '2:00 PM', isOwn: false },
                    ]
                }
            ]
        }
    ],
    currentUser: {
        name: 'Me',
        avatar: 'M'
    }
};

export const initialUsers = [
    { id: 'u1', name: 'Alice', status: 'online' },
    { id: 'u2', name: 'Bob', status: 'busy' },
    { id: 'u3', name: 'Charlie', status: 'offline' },
    { id: 'u4', name: 'David', status: 'online' }
];

export const initialMessages = [];
