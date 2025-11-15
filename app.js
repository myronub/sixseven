// Supabase configuration
const SUPABASE_URL = 'https://ajpjmocfhcekpkoufkan.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqcGptb2NmaGNla3Brb3Vma2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTk1ODUsImV4cCI6MjA3ODc5NTU4NX0.DOkNHEaNKH78yVpFDLbo-eHAfy1W8fZNLbaOsxNEOA8';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    setupEventListeners();
    
    // Load page-specific content
    const path = window.location.pathname;
    if (path.includes('/lb')) {
        loadLeaderboard();
    } else if (path.includes('/matches')) {
        loadMatchRequests();
    } else if (path.includes('/proofs')) {
        loadRecentProofs();
    } else if (path.includes('/replays')) {
        loadReplays();
    } else if (path === '/' || path.includes('/index.html')) {
        loadHomeStats();
    }
});

// Check authentication state
async function checkAuthState() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        currentUser = user;
        updateUIForUser(user);
        
        // Try to get user profile
        const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profile) {
            const userDisplayName = document.getElementById('user-display-name');
            if (userDisplayName) {
                userDisplayName.textContent = profile.display_name || profile.username;
            }
        }
    } else {
        currentUser = null;
        updateUIForGuest();
    }
}

// Update UI for logged in user
function updateUIForUser(user) {
    const authBtn = document.getElementById('auth-btn');
    const userDisplayName = document.getElementById('user-display-name');
    
    if (authBtn) authBtn.textContent = 'Logout';
    if (userDisplayName) userDisplayName.classList.remove('hidden');
}

// Update UI for guest
function updateUIForGuest() {
    const authBtn = document.getElementById('auth-btn');
    const userDisplayName = document.getElementById('user-display-name');
    
    if (authBtn) authBtn.textContent = 'Sign In';
    if (userDisplayName) {
        userDisplayName.classList.add('hidden');
        userDisplayName.textContent = 'Guest';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Auth button
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.addEventListener('click', function() {
            if (currentUser) {
                logoutUser();
            } else {
                window.location.href = '/auth/';
            }
        });
    }

    // Auth forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            await loginUser(email, password);
        });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const username = document.getElementById('signup-username').value;
            const displayName = document.getElementById('signup-display-name').value;
            const password = document.getElementById('signup-password').value;
            await signupUser(email, password, username, displayName);
        });
    }

    // Auth tabs
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            authTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const authForms = document.querySelectorAll('.auth-form');
            authForms.forEach(form => form.classList.remove('active'));
            document.getElementById(`${tabName}-form`).classList.add('active');
        });
    });

    // Search functionality
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchOpponents);
    }

    const opponentSearch = document.getElementById('opponent-search');
    if (opponentSearch) {
        opponentSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchOpponents();
            }
        });
    }
}

// User login
async function loginUser(email, password) {
    const loginMessage = document.getElementById('login-message');
    if (loginMessage) {
        loginMessage.textContent = 'Logging in...';
        loginMessage.className = 'mt-1';
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        if (loginMessage) {
            loginMessage.textContent = error.message;
            loginMessage.className = 'error-message mt-1';
        }
    } else {
        if (loginMessage) {
            loginMessage.textContent = 'Login successful! Redirecting...';
            loginMessage.className = 'success-message mt-1';
        }
        
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    }
}

// User signup
async function signupUser(email, password, username, displayName) {
    const signupMessage = document.getElementById('signup-message');
    if (signupMessage) {
        signupMessage.textContent = 'Creating account...';
        signupMessage.className = 'mt-1';
    }
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username,
                display_name: displayName
            }
        }
    });
    
    if (error) {
        if (signupMessage) {
            signupMessage.textContent = error.message;
            signupMessage.className = 'error-message mt-1';
        }
    } else {
        const { error: profileError } = await supabase
            .from('users')
            .insert([
                { 
                    id: data.user.id, 
                    email: email,
                    username: username, 
                    display_name: displayName 
                }
            ]);
        
        if (profileError) {
            if (signupMessage) {
                signupMessage.textContent = 'Account created but profile setup failed: ' + profileError.message;
                signupMessage.className = 'error-message mt-1';
            }
        } else {
            if (signupMessage) {
                signupMessage.textContent = 'Account created successfully! Please check your email for verification.';
                signupMessage.className = 'success-message mt-1';
            }
            
            const signupForm = document.getElementById('signup-form');
            if (signupForm) signupForm.reset();
        }
    }
}

// User logout
async function logoutUser() {
    const { error } = await supabase.auth.signOut();
    window.location.reload();
}

// Search opponents
async function searchOpponents() {
    const searchInput = document.getElementById('opponent-search');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchResults) return;
    
    const query = searchInput.value.trim();
    if (!query) return;
    
    searchResults.innerHTML = '<p class="text-center">Searching...</p>';
    
    // In a real implementation, this would search Supabase
    setTimeout(() => {
        const mockUsers = [
            { id: 1, username: 'ProPlayer1', display_name: 'Pro Player', win_rate: '90%' },
            { id: 2, username: 'Champion2', display_name: 'The Champion', win_rate: '84%' },
            { id: 3, username: 'SkillMaster', display_name: 'Skill Master', win_rate: '79%' }
        ].filter(user => 
            user.username.toLowerCase().includes(query.toLowerCase()) || 
            user.display_name.toLowerCase().includes(query.toLowerCase())
        );
        
        searchResults.innerHTML = '';
        
        if (mockUsers.length === 0) {
            searchResults.innerHTML = '<p class="text-center">No users found</p>';
            return;
        }
        
        mockUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div>
                    <strong>${user.display_name}</strong>
                    <p>@${user.username} • Win Rate: ${user.win_rate}</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="sendMatchRequest(${user.id})">Challenge</button>
            `;
            searchResults.appendChild(userItem);
        });
    }, 1000);
}

// Send match request
function sendMatchRequest(userId) {
    if (!currentUser) {
        alert('Please sign in to send match requests');
        return;
    }
    alert(`Match request sent to user ${userId}`);
    // In real implementation, this would insert into Supabase
}

// Load leaderboard data
async function loadLeaderboard() {
    const leaderboardContent = document.querySelector('.leaderboard-content');
    if (!leaderboardContent) return;
    
    leaderboardContent.innerHTML = '<div class="leaderboard-row text-center">Loading...</div>';
    
    setTimeout(() => {
        const mockLeaderboard = [
            { rank: 1, username: 'ProPlayer1', display_name: 'Pro Player', wins: 45, losses: 5, win_rate: '90.0%' },
            { rank: 2, username: 'Champion2', display_name: 'The Champion', wins: 38, losses: 7, win_rate: '84.4%' },
            { rank: 3, username: 'EliteGamer', display_name: 'Elite Gamer', wins: 52, losses: 13, win_rate: '80.0%' },
            { rank: 4, username: 'SkillMaster', display_name: 'Skill Master', wins: 30, losses: 8, win_rate: '78.9%' },
            { rank: 5, username: 'VictoryKing', display_name: 'Victory King', wins: 42, losses: 12, win_rate: '77.8%' }
        ];
        
        leaderboardContent.innerHTML = '';
        
        mockLeaderboard.forEach(player => {
            const row = document.createElement('div');
            row.className = `leaderboard-row ${player.rank <= 3 ? 'top-3' : ''}`;
            row.innerHTML = `
                <div class="rank">#${player.rank}</div>
                <div class="player-name">${player.display_name}</div>
                <div>${player.wins}</div>
                <div>${player.losses}</div>
                <div class="win-rate">${player.win_rate}</div>
            `;
            leaderboardContent.appendChild(row);
        });
    }, 1000);
}

// Load match requests
async function loadMatchRequests() {
    const matchRequests = document.getElementById('match-requests');
    if (!matchRequests) return;
    
    matchRequests.innerHTML = '<p class="text-center">Loading...</p>';
    
    setTimeout(() => {
        if (currentUser) {
            matchRequests.innerHTML = `
                <div class="request-item">
                    <div>
                        <strong>ProPlayer1</strong>
                        <p>Sent 2 hours ago</p>
                    </div>
                    <div>
                        <button class="btn btn-primary btn-sm">Accept</button>
                        <button class="btn btn-outline btn-sm">Decline</button>
                    </div>
                </div>
            `;
        } else {
            matchRequests.innerHTML = '<p class="text-center">Please sign in to view match requests</p>';
        }
    }, 1000);
}

// Load recent proofs
async function loadRecentProofs() {
    const proofsGrid = document.querySelector('.proofs-grid');
    if (!proofsGrid) return;
    
    proofsGrid.innerHTML = '<p class="text-center">Loading...</p>';
    
    setTimeout(() => {
        const mockProofs = [
            { id: 1, player1: 'ProPlayer1', player2: 'Champion2', winner: 'ProPlayer1', date: '2023-11-15', verified: true },
            { id: 2, player1: 'EliteGamer', player2: 'SkillMaster', winner: 'SkillMaster', date: '2023-11-14', verified: true }
        ];
        
        proofsGrid.innerHTML = '';
        
        mockProofs.forEach(proof => {
            const card = document.createElement('div');
            card.className = 'proof-card';
            card.innerHTML = `
                <div class="proof-header">
                    <span>${proof.player1} vs ${proof.player2}</span>
                    <span>${proof.verified ? '✓ Verified' : 'Pending'}</span>
                </div>
                <div class="proof-content">
                    <p><strong>Winner:</strong> ${proof.winner}</p>
                    <p><strong>Date:</strong> ${proof.date}</p>
                </div>
                <div class="proof-actions">
                    <button class="btn btn-outline">View Proof</button>
                    <button class="btn btn-primary">Watch Replay</button>
                </div>
            `;
            proofsGrid.appendChild(card);
        });
    }, 1000);
}

// Load replays
async function loadReplays() {
    const replayItems = document.querySelector('.replay-items');
    if (!replayItems) return;
    
    replayItems.innerHTML = '<p class="text-center">Loading...</p>';
    
    setTimeout(() => {
        const mockReplays = [
            { id: 1, players: 'ProPlayer1 vs Champion2', date: '2023-11-15', duration: '15:32' },
            { id: 2, players: 'EliteGamer vs SkillMaster', date: '2023-11-14', duration: '12:45' }
        ];
        
        replayItems.innerHTML = '';
        
        mockReplays.forEach(replay => {
            const item = document.createElement('div');
            item.className = 'replay-item';
            item.innerHTML = `
                <div>
                    <strong>${replay.players}</strong>
                    <p>${replay.date} • ${replay.duration}</p>
                </div>
                <button class="btn btn-primary">Watch</button>
            `;
            replayItems.appendChild(item);
        });
    }, 1000);
}

// Load home stats
async function loadHomeStats() {
    // This would fetch real stats from Supabase
    console.log('Loading home stats...');
}