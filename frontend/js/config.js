// Backend API URL
// Production (Render)  : https://medistock-api-zudg.onrender.com
// Local development    : http://127.0.0.1:5000
//
// The deployed site talks to the live Render API, while a local copy of the
// frontend keeps talking to the local Flask server. Override it any time with
//   window.MEDISTOCK_API_URL = 'https://...'
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];
const API_BASE_URL = window.MEDISTOCK_API_URL
    || (LOCAL_HOSTS.indexOf(location.hostname) !== -1
        ? 'http://127.0.0.1:5000'
        : 'https://medistock-api-zudg.onrender.com');

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
