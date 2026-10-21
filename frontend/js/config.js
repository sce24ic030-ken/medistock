// Backend API URL
// For local development
const API_BASE_URL = 'http://127.0.0.1:5000';

// For production (update after deploying to Render)
// const API_BASE_URL = 'https://your-backend-app.onrender.com';

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Something went wrong');
        }
        
        return result;
    } catch (error) {
        throw error;
    }
}
