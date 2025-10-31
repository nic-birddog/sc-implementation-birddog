import * as socketClusterClient from 'socketcluster-client';
import fs from 'fs';

// Authentication credentials
const AUTH_CREDENTIALS = {
  userName: 'nic@birddog.tv',
  password: 'Nc070790',
  stayLoggedIn: true
};

// Setup logging to file
const logFile = 'output.log';
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

// Override console methods to log to both console and file
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  originalLog.apply(console, args);
  logStream.write(message + '\n');
};

console.error = function(...args) {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  originalError.apply(console, args);
  logStream.write('[ERROR] ' + message + '\n');
};

console.log(`\n📝 Logging output to: ${logFile}`);
console.log('========================================\n');

const LOGIN_URL = 'https://connect.birddog.tv/api/login';
const LOAD_TOKEN_URL = 'https://connect.birddog.tv/api/load-token';

// Function to login and get JWT token using load-token endpoint
async function loginAndGetToken() {
  console.log('\n🔐 Step 1: Logging in to Birddog API...');

  try {
    // Step 1: Login to establish session
    const loginResponse = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: Include cookies in subsequent requests
      body: JSON.stringify(AUTH_CREDENTIALS)
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log('Login response:', JSON.stringify(loginData, null, 2));

    // Extract cookies from login response
    const setCookieHeaders = loginResponse.headers.getSetCookie?.() || [];
    console.log('Set-Cookie headers:', setCookieHeaders);

    // Parse cookies from Set-Cookie headers
    const cookies = setCookieHeaders.map(cookie => {
      // Extract just the cookie name=value part (before the first semicolon)
      return cookie.split(';')[0];
    }).join('; ');

    console.log('Parsed cookies:', cookies);

    // Store cookies globally for token refresh
    loginCookies = cookies;

    // Step 2: Call load-token to get JWT
    console.log('\n🎫 Step 2: Loading JWT token from /api/load-token...');

    const tokenResponse = await fetch(LOAD_TOKEN_URL, {
      method: 'GET',
      headers: {
        'Cookie': cookies, // Manually send the cookies
      },
    });
    console.log('Load token response status:', tokenResponse.status);   
    if (!tokenResponse.ok) {
      throw new Error(`Load token failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token loaded successfully!');
    console.log('Token response:', JSON.stringify(tokenData, null, 2));

    // Extract JWT token from response
    let token = null;

    if (tokenData.token) {
      token = tokenData.token;
      console.log('🎫 JWT token found in response.token');
    } else if (tokenData.auth) {
      token = tokenData.auth;
      console.log('🎫 JWT token found in response.auth');
    } else if (typeof tokenData === 'string') {
      token = tokenData;
      console.log('🎫 JWT token is the response itself');
    }

    if (token) {
      console.log(`Token preview: ${token.substring(0, 50)}...`);
      console.log(`Token length: ${token.length} characters`);
      return token;
    } else {
      console.log('⚠️ Token not found in response');
      console.log('Full response structure:', Object.keys(tokenData));
      return null;
    }

  } catch (err) {
    console.error('❌ Authentication failed:', err.message);
    throw err;
  }
}

// Store login cookies globally so we can refresh tokens
let loginCookies = '';

// Function to get a fresh JWT token
async function getFreshToken() {
  console.log('\n🔄 Getting fresh JWT token...');
  try {
    const tokenResponse = await fetch(LOAD_TOKEN_URL, {
      method: 'GET',
      headers: {
        'Cookie': loginCookies,
      },
    });

    if (tokenResponse.ok) {
      const token = await tokenResponse.json();
      console.log('✅ Fresh token obtained');
      return token;
    } else {
      console.error('❌ Failed to get fresh token:', tokenResponse.status);
      return null;
    }
  } catch (err) {
    console.error('❌ Error getting fresh token:', err.message);
    return null;
  }
}

// Login and get JWT token
const jwtToken = await loginAndGetToken();

console.log('\n========================================');
console.log('🎯 Ready to connect to SocketCluster');
console.log('📡 Connections will be loaded from WebSocket channel');
console.log('========================================\n');

// Company ID from your account
const COMPANY_ID = '808410864692330497';

// Filter configuration - customize this to identify YOUR endpoint
const MY_ENDPOINT_FILTER = {
  // Option 1: Filter by endpoint ID (if you know your endpoint's ID)
  endpointId: null,  // e.g., '1113326954838360065'

  // Option 2: Filter by claim code (easier to remember than endpoint ID)
  claimCode: 'Nq62MPd9',  // Nic 4k Converter claim code

  // Option 3: Filter by video source name pattern
  videoSourcePattern: null,  // e.g., 'BIRDDOG-05EAD' or regex pattern

  // Option 4: Filter by IP address
  ipAddress: null,  // e.g., '192.168.1.100'

  // Option 5: Custom filter function (you can implement your own logic)
  customFilter: null  // function(connection) { return boolean; }
};

// Helper function to check if a connection is from "my endpoint"
function isMyEndpointConnection(conn) {
  // Resolve endpoint ID from claim code if needed
  let targetEndpointId = MY_ENDPOINT_FILTER.endpointId;

  if (!targetEndpointId && MY_ENDPOINT_FILTER.claimCode) {
    // Look up endpoint ID by claim code
    targetEndpointId = endpointLookup.byClaimCode[MY_ENDPOINT_FILTER.claimCode];
  }

  // Filter by endpoint ID (direct or resolved from claim code)
  if (targetEndpointId) {
    if (conn.sourceId === targetEndpointId ||
        conn.targetId === targetEndpointId) {
      return true;
    }
  }

  // Filter by video source pattern
  if (MY_ENDPOINT_FILTER.videoSourcePattern && conn.parameters?.videoSources) {
    const pattern = MY_ENDPOINT_FILTER.videoSourcePattern;
    const hasMatch = conn.parameters.videoSources.some(source =>
      typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source)
    );
    if (hasMatch) return true;
  }

  // Filter by IP address
  if (MY_ENDPOINT_FILTER.ipAddress) {
    if (conn.sourceIp === MY_ENDPOINT_FILTER.ipAddress ||
        conn.targetIp === MY_ENDPOINT_FILTER.ipAddress) {
      return true;
    }
  }

  // Custom filter function
  if (MY_ENDPOINT_FILTER.customFilter && typeof MY_ENDPOINT_FILTER.customFilter === 'function') {
    return MY_ENDPOINT_FILTER.customFilter(conn);
  }

  return false;
}

// Data channel state - stores entities for each channel
const channelData = {};

// Endpoint lookup - maps claim codes to endpoint IDs
const endpointLookup = {
  byClaimCode: {},  // claimCode -> endpointId
  byId: {}          // endpointId -> endpoint object
};

// Subscribe to Data Channels - try both formats to see which works
// Per BDC3 spec: /<entity-type>/<Company ID>
const CHANNELS_TO_SUBSCRIBE = [
  `/endpoints/${COMPANY_ID}`,     // Get endpoints first to resolve claim codes
  `/connections/${COMPANY_ID}`,   // Then get connections
];

// Initialize storage
CHANNELS_TO_SUBSCRIBE.forEach(channel => {
  const key = channel.replace('/', '').replace(/\//g, '_');
  channelData[key] = [];
});

// Create socket with WebSocket URL
const WEBSOCKET_URL = 'wss://connect.birddog.tv/socketcluster/';

const options = {
  hostname: 'connect.birddog.tv',
  port: 443,
  secure: true,
  path: '/socketcluster/',
  autoReconnectOptions: {
    initialDelay: 1000,
    maxDelay: 5000,
  }
};

console.log(`\nAttempting to connect to ${WEBSOCKET_URL}`);

const socket = socketClusterClient.create(options);

// Data Channel message handlers (per BDC3 spec)

// Special handler for endpoints channel - builds lookup tables
function handleEndpointsInit(channelKey, data) {
  channelData[channelKey] = data;
  console.log(`\n✅ [${channelKey}] INIT - Loaded ${data.length} endpoints`);

  // Build lookup tables
  data.forEach(endpoint => {
    endpointLookup.byId[endpoint.id] = endpoint;
    if (endpoint.code) {
      endpointLookup.byClaimCode[endpoint.code] = endpoint.id;
    }
  });

  console.log(`📋 Built endpoint lookup with ${Object.keys(endpointLookup.byClaimCode).length} claim codes`);

  // If we're filtering by claim code, show which endpoint was found
  if (MY_ENDPOINT_FILTER.claimCode) {
    const endpointId = endpointLookup.byClaimCode[MY_ENDPOINT_FILTER.claimCode];
    if (endpointId) {
      const endpoint = endpointLookup.byId[endpointId];
      console.log(`\n🎯 Found endpoint for claim code "${MY_ENDPOINT_FILTER.claimCode}":`);
      console.log(`   ID: ${endpoint.id}`);
      console.log(`   Name: ${endpoint.name}`);
      console.log(`   Type: ${endpoint.type}`);
      console.log(`   Online: ${endpoint.online}`);
    } else {
      console.log(`\n⚠️ Claim code "${MY_ENDPOINT_FILTER.claimCode}" not found in endpoints list`);
    }
  }
}

function handleInit(channelKey, data) {
  channelData[channelKey] = data;
  console.log(`\n✅ [${channelKey}] INIT - Loaded ${data.length} total items`);

  // Filter MY endpoint connections
  const myConnections = data.filter(conn => isMyEndpointConnection(conn));

  if (myConnections.length > 0) {
    console.log(`\n🎯 MY CONNECTIONS (${myConnections.length} found):`);
    console.log('='.repeat(80));

    myConnections.forEach((conn, index) => {
      console.log(`\n[${index + 1}/${myConnections.length}] Connection ID: ${conn.id}`);
      console.log(`   Source: ${conn.sourceId || 'N/A'}`);
      console.log(`   Target: ${conn.targetId || 'N/A'}`);
      console.log(`   State: ${conn.state} (${conn.isStarted ? 'Started' : 'Not Started'})`);
      console.log(`   Protocol: ${conn.parameters?.protocol || 'N/A'}`);
      if (conn.parameters?.videoSources?.length > 0) {
        console.log(`   Video Sources: ${conn.parameters.videoSources.join(', ')}`);
      }
      if (conn.error) {
        console.log(`   Error: ${conn.error}`);
      }
    });
    console.log('\n' + '='.repeat(80));
  } else {
    console.log('\n⚠️ No connections matching MY_ENDPOINT_FILTER found');
    console.log('💡 Tip: Update MY_ENDPOINT_FILTER at the top of the file to filter your endpoint');
  }
}

function handleAdd(channelKey, item) {
  const arr = channelData[channelKey];
  if (!arr) return;

  const index = arr.findIndex(el => el.id === item.id);
  if (index === -1) {
    arr.push(item);
  } else {
    arr[index] = item;
  }

  // Only log if it's MY connection
  if (isMyEndpointConnection(item)) {
    console.log(`\n➕ [MY CONNECTION] ${index === -1 ? 'NEW' : 'UPDATED'} - ID: ${item.id}`);
    console.log(`   Source: ${item.sourceId || 'N/A'}`);
    console.log(`   Target: ${item.targetId || 'N/A'}`);
    console.log(`   State: ${item.state} (${item.isStarted ? 'Started' : 'Not Started'})`);
    console.log(`   Protocol: ${item.parameters?.protocol || 'N/A'}`);
    if (item.parameters?.videoSources?.length > 0) {
      console.log(`   Video Sources: ${item.parameters.videoSources.join(', ')}`);
    }
    if (item.error) {
      console.log(`   Error: ${item.error}`);
    }
  }
}

function handleUpdate(channelKey, {id, data}) {
  const arr = channelData[channelKey];
  if (!arr) return;

  const index = arr.findIndex(el => el.id === id);
  if (index === -1) {
    return;
  }

  // Shallow merge the changes
  Object.assign(arr[index], data);

  // Only log if it's MY connection
  if (isMyEndpointConnection(arr[index])) {
    console.log(`\n🔄 [MY CONNECTION] UPDATE - ID: ${id}`);
    console.log(`   Changed fields: ${Object.keys(data).join(', ')}`);
    console.log(`   New values:`, JSON.stringify(data, null, 2));
  }
}

function handleDelete(channelKey, id) {
  const arr = channelData[channelKey];
  if (!arr) return;

  const index = arr.findIndex(el => el.id === id);
  if (index !== -1) {
    const removed = arr[index];

    // Only log if it's MY connection
    if (isMyEndpointConnection(removed)) {
      console.log(`\n🗑️ [MY CONNECTION] DELETED - ID: ${id}`);
      console.log(`   Was: ${removed.sourceId} -> ${removed.targetId} (${removed.state})`);
    }

    arr.splice(index, 1);
  }
}

// Function to subscribe to channels (called after authentication)
function subscribeToChannels() {
  console.log('\n📡 Subscribing to Data Channels...');

  CHANNELS_TO_SUBSCRIBE.forEach((channelName) => {
    (async () => {
      try {
        const channel = socket.subscribe(channelName);
        console.log(`\n🔔 Subscribing to ${channelName}`);

        // Extract channel type: "/connections" -> "connections"
        const channelType = channelName.replace('/', '');  // Remove leading slash
        const channelKey = channelType;  // Use simple key like "connections"

        for await (let message of channel) {
          console.log(`\n========================================`);
          console.log(`📨 [${channelType.toUpperCase()}] Message received`);
          console.log(`========================================`);

          // BDC3 Data Channel format: { "msg": <type>, "data": <...> }
          if (!message || !message.msg) {
            console.log('⚠️ Invalid message format:', message);
            continue;
          }

          const { msg, data } = message;
          console.log(`Message type: ${msg}`);

          // Handle message based on type
          switch (msg) {
            case 'init':
              // Use special handler for endpoints channel
              if (channelKey.includes('endpoints')) {
                handleEndpointsInit(channelKey, data);
              } else {
                handleInit(channelKey, data);
              }
              console.log(`\nCurrent count: ${channelData[channelKey].length}`);
              break;

            case 'add':
              handleAdd(channelKey, data);
              console.log(`\nCurrent count: ${channelData[channelKey].length}`);
              break;

            case 'update':
              handleUpdate(channelKey, data);
              break;

            case 'delete':
              handleDelete(channelKey, data);
              console.log(`\nCurrent count: ${channelData[channelKey].length}`);
              break;

            default:
              console.log(`⚠️ Unknown message type: ${msg}`);
          }

          console.log(`========================================\n`);
        }
      } catch (err) {
        console.error(`\n❌ Error on ${channelName}:`, err.message);
      }
    })();
  });
}

// Handle connection events
(async () => {
  for await (let _event of socket.listener('connect')) {
    console.log('\n✅ **Connected** to Birddog TV SocketCluster!');
    console.log(`Socket ID: ${socket.id}`);
    console.log(`Connection state: ${socket.state}`);

    // Check if authenticated with JWT token
    const currentToken = socket.authToken;
    if (currentToken) {
      console.log('\n🎫 Socket has auth token');
      console.log(`Token preview: ${JSON.stringify(currentToken).substring(0, 50)}...`);
      console.log(`Auth state: ${socket.authState}`);
    } else {
      console.log('\n⚠️ No JWT token found on socket');
    }

    // Get a fresh JWT token right before authenticating
    try {
      console.log('\n🔐 Getting fresh token and authenticating socket...');
      const freshToken = await getFreshToken();

      if (freshToken) {
        await socket.authenticate(freshToken);
        console.log('✅ Socket authenticated with fresh token!');
        console.log(`Auth state: ${socket.authState}`);

        // Subscribe to channels after successful authentication
        subscribeToChannels();
      } else {
        console.error('❌ Could not get fresh token');
      }
    } catch (err) {
      console.error('❌ Socket authenticate() failed:', err.message);
      console.log('Attempting to subscribe anyway...');
      subscribeToChannels();
    }
  }
})();

// Handle disconnection events
(async () => {
  for await (let event of socket.listener('disconnect')) {
    console.log(`\n🔴 Disconnected: ${event.code} ${event.reason}`);
  }
})();

// Handle errors
(async () => {
  for await (let event of socket.listener('error')) {
    console.error('\n🚨 Socket Error:', event.error);
  }
})();

// Listen for authentication state changes
(async () => {
  for await (let event of socket.listener('authenticate')) {
    console.log('\n🎫 Authenticated! Token info:', {
      signedAuthToken: event.signedAuthToken?.substring(0, 50) + '...',
      authToken: event.authToken
    });
  }
})();

(async () => {
  for await (let event of socket.listener('deauthenticate')) {
    console.log('\n🔓 Deauthenticated');
    if (event.oldSignedAuthToken) {
      console.log('Old token was removed');
    }
  }
})();

// Listen for auth token changes
(async () => {
  for await (let event of socket.listener('authTokenChange')) {
    console.log('\n🔄 Auth token changed');
    console.log('New token preview:', event.signedAuthToken?.substring(0, 50) + '...');
  }
})();

// Listen for subscription state changes
(async () => {
  for await (let event of socket.listener('subscribe')) {
    console.log(`\n✅ Successfully subscribed to: ${event.channel}`);
  }
})();

(async () => {
  for await (let event of socket.listener('subscribeFail')) {
    console.error(`\n❌ Failed to subscribe to: ${event.channel}`, event.error);
  }
})();

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n\n========================================');
  console.log('🛑 Shutting down gracefully...');
  console.log('========================================');
  logStream.end();
  socket.disconnect();
  process.exit(0);
});