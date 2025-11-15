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
        loadAvailablePlayers();
    } else if (path.includes('/proofs')) {
        loadRecentProofs();
    } else if (path.includes('/replays')) {
        loadReplays();
    } else if (path.includes('/auth')) {
        // Auth page - no additional loading needed
    } else if (path === '/' || path.includes('/index.html')) {
        loadHomeStats();
        loadAvailablePlayers();
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
                window.location.href = 'auth/';
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

    // Quick search on home page
    const quickSearchBtn = document.querySelector('.search-section .btn-primary');
    if (quickSearchBtn && !quickSearchBtn.id) {
        quickSearchBtn.addEventListener('click', loadAvailablePlayers);
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
            window.location.href = '../';
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
    
    // Create auth user
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
        // Create user profile in users table with default values
        const { error: profileError } = await supabase
            .from('users')
            .insert([
                { 
                    id: data.user.id, 
                    email: email,
                    username: username, 
                    display_name: displayName,
                    wins: 0,
                    losses: 0,
                    winrate: 0,
                    created_at: new Date().toISOString()
                }
            ]);
        
        if (profileError) {
            console.error('Profile creation error:', profileError);
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
            
            // Switch to login tab after successful signup
            setTimeout(() => {
                const authTabs = document.querySelectorAll('.auth-tab');
                const authForms = document.querySelectorAll('.auth-form');
                
                authTabs.forEach(t => t.classList.remove('active'));
                authTabs[0].classList.add('active');
                
                authForms.forEach(form => form.classList.remove('active'));
                authForms[0].classList.add('active');
            }, 2000);
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
    
    searchResults.innerHTML = '<div class="user-item text-center">Searching...</div>';
    
    try {
        // Search users in Supabase
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, display_name, wins, losses, winrate')
            .neq('id', currentUser?.id) // Exclude current user
            .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
            .limit(10);
        
        if (error) throw error;
        
        searchResults.innerHTML = '';
        
        if (!users || users.length === 0) {
            searchResults.innerHTML = '<div class="user-item text-center">No users found</div>';
            return;
        }
        
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div>
                    <strong>${user.display_name || user.username}</strong>
                    <p>@${user.username} • Win Rate: ${user.winrate || 0}%</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="sendMatchRequest('${user.id}')">Challenge</button>
            `;
            searchResults.appendChild(userItem);
        });
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="user-item text-center">Error searching users</div>';
    }
}

// Load available players for home page
async function loadAvailablePlayers() {
    const userList = document.querySelector('.search-section .user-list');
    if (!userList) return;
    
    userList.innerHTML = '<div class="user-item text-center">Loading...</div>';
    
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, display_name, wins, losses, winrate')
            .neq('id', currentUser?.id)
            .order('winrate', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        userList.innerHTML = '';
        
        if (!users || users.length === 0) {
            userList.innerHTML = '<div class="user-item text-center">No players available</div>';
            return;
        }
        
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div>
                    <strong>${user.display_name || user.username}</strong>
                    <p>@${user.username} • Win Rate: ${user.winrate || 0}%</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="sendMatchRequest('${user.id}')">Challenge</button>
            `;
            userList.appendChild(userItem);
        });
    } catch (error) {
        console.error('Error loading players:', error);
        userList.innerHTML = '<div class="user-item text-center">Error loading players</div>';
    }
}

// Send match request
async function sendMatchRequest(opponentId) {
    if (!currentUser) {
        alert('Please sign in to send match requests');
        window.location.href = 'auth/';
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('match_requests')
            .insert([
                {
                    challenger_id: currentUser.id,
                    opponent_id: opponentId,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }
            ]);
        
        if (error) throw error;
        
        alert('Match request sent successfully!');
        
        // Reload match requests if on matches page
        if (window.location.pathname.includes('/matches')) {
            loadMatchRequests();
        }
    } catch (error) {
        console.error('Error sending match request:', error);
        alert('Error sending match request: ' + error.message);
    }
}

// Load leaderboard data
async function loadLeaderboard() {
    const leaderboardContent = document.querySelector('.leaderboard-content');
    if (!leaderboardContent) return;
    
    leaderboardContent.innerHTML = '<div class="leaderboard-row text-center">Loading...</div>';
    
    try {
        const { data: players, error } = await supabase
            .from('users')
            .select('id, username, display_name, wins, losses, winrate')
            .gte('wins', 1) // Only show players with at least 1 win
            .order('winrate', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        leaderboardContent.innerHTML = '';
        
        if (!players || players.length === 0) {
            leaderboardContent.innerHTML = '<div class="leaderboard-row text-center">No players yet</div>';
            return;
        }
        
        players.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = `leaderboard-row ${index < 3 ? 'top-3' : ''}`;
            row.innerHTML = `
                <div class="rank">#${index + 1}</div>
                <div class="player-name">${player.display_name || player.username}</div>
                <div>${player.wins || 0}</div>
                <div>${player.losses || 0}</div>
                <div class="win-rate">${player.winrate || 0}%</div>
            `;
            leaderboardContent.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardContent.innerHTML = '<div class="leaderboard-row text-center">Error loading leaderboard</div>';
    }
}

// Load match requests
async function loadMatchRequests() {
    const matchRequests = document.getElementById('match-requests');
    if (!matchRequests) return;
    
    matchRequests.innerHTML = '<div class="request-item text-center">Loading...</div>';
    
    if (!currentUser) {
        matchRequests.innerHTML = '<div class="request-item text-center">Please sign in to view match requests</div>';
        return;
    }
    
    try {
        // Get incoming requests
        const { data: incomingRequests, error: incomingError } = await supabase
            .from('match_requests')
            .select(`
                id,
                challenger_id,
                status,
                created_at,
                users!match_requests_challenger_id_fkey(username, display_name)
            `)
            .eq('opponent_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (incomingError) throw incomingError;
        
        // Get outgoing requests
        const { data: outgoingRequests, error: outgoingError } = await supabase
            .from('match_requests')
            .select(`
                id,
                opponent_id,
                status,
                created_at,
                users!match_requests_opponent_id_fkey(username, display_name)
            `)
            .eq('challenger_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (outgoingError) throw outgoingError;
        
        matchRequests.innerHTML = '';
        
        // Show incoming requests
        if (incomingRequests && incomingRequests.length > 0) {
            const incomingHeader = document.createElement('h4');
            incomingHeader.textContent = 'Incoming Requests';
            incomingHeader.style.marginBottom = '1rem';
            incomingHeader.style.color = 'var(--secondary)';
            matchRequests.appendChild(incomingHeader);
            
            incomingRequests.forEach(request => {
                const requestItem = document.createElement('div');
                requestItem.className = 'request-item';
                requestItem.innerHTML = `
                    <div>
                        <strong>${request.users.display_name || request.users.username}</strong>
                        <p>Sent ${formatDate(request.created_at)}</p>
                    </div>
                    <div>
                        <button class="btn btn-primary btn-sm" onclick="respondToMatchRequest('${request.id}', 'accepted')">Accept</button>
                        <button class="btn btn-outline btn-sm" onclick="respondToMatchRequest('${request.id}', 'declined')">Decline</button>
                    </div>
                `;
                matchRequests.appendChild(requestItem);
            });
        }
        
        // Show outgoing requests
        if (outgoingRequests && outgoingRequests.length > 0) {
            const outgoingHeader = document.createElement('h4');
            outgoingHeader.textContent = 'Outgoing Requests';
            outgoingHeader.style.marginTop = '2rem';
            outgoingHeader.style.marginBottom = '1rem';
            outgoingHeader.style.color = 'var(--secondary)';
            matchRequests.appendChild(outgoingHeader);
            
            outgoingRequests.forEach(request => {
                const requestItem = document.createElement('div');
                requestItem.className = 'request-item';
                requestItem.innerHTML = `
                    <div>
                        <strong>${request.users.display_name || request.users.username}</strong>
                        <p>Sent ${formatDate(request.created_at)} • Pending</p>
                    </div>
                    <div>
                        <button class="btn btn-danger btn-sm" onclick="cancelMatchRequest('${request.id}')">Cancel</button>
                    </div>
                `;
                matchRequests.appendChild(requestItem);
            });
        }
        
        if (incomingRequests.length === 0 && outgoingRequests.length === 0) {
            matchRequests.innerHTML = '<div class="request-item text-center">No pending match requests</div>';
        }
    } catch (error) {
        console.error('Error loading match requests:', error);
        matchRequests.innerHTML = '<div class="request-item text-center">Error loading match requests</div>';
    }
}

// Respond to match request
async function respondToMatchRequest(requestId, response) {
    try {
        const { error } = await supabase
            .from('match_requests')
            .update({ 
                status: response,
                responded_at: new Date().toISOString()
            })
            .eq('id', requestId);
        
        if (error) throw error;
        
        alert(`Match request ${response}`);
        loadMatchRequests();
    } catch (error) {
        console.error('Error responding to match request:', error);
        alert('Error responding to match request');
    }
}

// Cancel match request
async function cancelMatchRequest(requestId) {
    try {
        const { error } = await supabase
            .from('match_requests')
            .delete()
            .eq('id', requestId);
        
        if (error) throw error;
        
        alert('Match request cancelled');
        loadMatchRequests();
    } catch (error) {
        console.error('Error cancelling match request:', error);
        alert('Error cancelling match request');
    }
}

// Load recent proofs
async function loadRecentProofs() {
    const proofsGrid = document.querySelector('.proofs-grid');
    if (!proofsGrid) return;
    
    proofsGrid.innerHTML = '<div class="proof-card text-center">Loading...</div>';
    
    try {
        // In a real implementation, you'd have a proofs table
        // For now, we'll use match_requests that were accepted
        const { data: completedMatches, error } = await supabase
            .from('match_requests')
            .select(`
                id,
                challenger_id,
                opponent_id,
                status,
                created_at,
                challenger:users!match_requests_challenger_id_fkey(username, display_name),
                opponent:users!match_requests_opponent_id_fkey(username, display_name)
            `)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false })
            .limit(6);
        
        if (error) throw error;
        
        proofsGrid.innerHTML = '';
        
        if (!completedMatches || completedMatches.length === 0) {
            proofsGrid.innerHTML = '<div class="proof-card text-center">No completed matches yet</div>';
            return;
        }
        
        completedMatches.forEach(match => {
            const card = document.createElement('div');
            card.className = 'proof-card';
            card.innerHTML = `
                <div class="proof-header">
                    <span>${match.challenger.display_name} vs ${match.opponent.display_name}</span>
                    <span>✓ Completed</span>
                </div>
                <div class="proof-content">
                    <p><strong>Match ID:</strong> ${match.id.slice(0, 8)}</p>
                    <p><strong>Date:</strong> ${formatDate(match.created_at)}</p>
                </div>
                <div class="proof-actions">
                    <button class="btn btn-outline" onclick="viewMatchDetails('${match.id}')">View Details</button>
                    <button class="btn btn-primary" onclick="watchReplay('${match.id}')">Watch Replay</button>
                </div>
            `;
            proofsGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading proofs:', error);
        proofsGrid.innerHTML = '<div class="proof-card text-center">Error loading match history</div>';
    }
}

// Load replays
async function loadReplays() {
    const replayItems = document.querySelector('.replay-items');
    if (!replayItems) return;
    
    replayItems.innerHTML = '<div class="replay-item text-center">Loading...</div>';
    
    try {
        const { data: completedMatches, error } = await supabase
            .from('match_requests')
            .select(`
                id,
                challenger_id,
                opponent_id,
                created_at,
                challenger:users!match_requests_challenger_id_fkey(username, display_name),
                opponent:users!match_requests_opponent_id_fkey(username, display_name)
            `)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        replayItems.innerHTML = '';
        
        if (!completedMatches || completedMatches.length === 0) {
            replayItems.innerHTML = '<div class="replay-item text-center">No replays available</div>';
            return;
        }
        
        completedMatches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'replay-item';
            item.innerHTML = `
                <div>
                    <strong>${match.challenger.display_name} vs ${match.opponent.display_name}</strong>
                    <p>${formatDate(match.created_at)} • Match ID: ${match.id.slice(0, 8)}</p>
                </div>
                <button class="btn btn-primary" onclick="watchReplay('${match.id}')">Watch</button>
            `;
            replayItems.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading replays:', error);
        replayItems.innerHTML = '<div class="replay-item text-center">Error loading replays</div>';
    }
}

// Load home stats
async function loadHomeStats() {
    try {
        // Get total users count
        const { count: totalUsers, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        // Get total matches count
        const { count: totalMatches, error: matchesError } = await supabase
            .from('match_requests')
            .select('*', { count: 'exact', head: true });
        
        // Get completed matches count
        const { count: completedMatches, error: completedError } = await supabase
            .from('match_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'accepted');
        
        if (!usersError && !matchesError && !completedError) {
            // Update stats cards if they exist
            const statNumbers = document.querySelectorAll('.stat-number');
            if (statNumbers.length >= 4) {
                statNumbers[0].textContent = totalUsers || '0';
                statNumbers[1].textContent = totalMatches || '0';
                statNumbers[2].textContent = completedMatches || '0';
                statNumbers[3].textContent = '92%'; // Static satisfaction rate
            }
        }
    } catch (error) {
        console.error('Error loading home stats:', error);
    }
}

// Watch replay (placeholder function)
function watchReplay(matchId) {
    alert(`Would play replay for match: ${matchId}\n\nIn a real implementation, this would load the actual replay viewer.`);
    
    // Update replay player section
    const replayPlayer = document.querySelector('.replay-player');
    if (replayPlayer) {
        replayPlayer.innerHTML = `
            <div style="text-align: center;">
                <h3>Replay: Match ${matchId.slice(0, 8)}</h3>
                <p>Replay player would be embedded here</p>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary">Play</button>
                    <button class="btn btn-outline">Pause</button>
                </div>
            </div>
        `;
    }
}

// View match details
function viewMatchDetails(matchId) {
    alert(`Match details for: ${matchId}\n\nThis would show detailed match information and proof.`);
}

// Utility function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

// Make functions globally available for onclick handlers
window.sendMatchRequest = sendMatchRequest;
window.respondToMatchRequest = respondToMatchRequest;
window.cancelMatchRequest = cancelMatchRequest;
window.watchReplay = watchReplay;
window.viewMatchDetails = viewMatchDetails;
