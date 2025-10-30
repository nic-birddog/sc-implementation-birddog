# SocketCluster Birddog Test Client

A Node.js client application for connecting to the Birddog TV SocketCluster server to monitor real-time WebRTC connections and device endpoints.

## Overview

This application demonstrates how to:
- Authenticate with the Birddog TV API
- Retrieve connection data via REST API
- Connect to SocketCluster WebSocket server
- Subscribe to real-time connection updates
- Handle JWT token authentication and refresh

## Features

- REST API authentication with session cookies
- JWT token management with automatic refresh
- WebSocket connection to SocketCluster
- Real-time subscription to `/connections` channel
- Automatic logging of all output to file
- Graceful shutdown handling

## Prerequisites

- Node.js v22+ (ES modules support)
- Birddog TV account credentials

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nic-birddog/sc-implementation-birddog.git
cd sc-implementation-birddog
```

2. Install dependencies:
```bash
npm install
```

## Configuration

Update your credentials in `index.js`:

```javascript
const AUTH_CREDENTIALS = {
  userName: 'your-email@example.com',
  password: 'your-password',
  stayLoggedIn: true
};
```

Update the organization ID if different:

```javascript
const ORG_ID = '808410864692330497';
```

## Usage

Run the client:

```bash
node index.js
```

The application will:
1. Login to Birddog API
2. Fetch initial connections from REST API
3. Load JWT authentication token
4. Connect to SocketCluster WebSocket
5. Authenticate with fresh JWT token
6. Subscribe to `/connections/{ORG_ID}` channel
7. Stream real-time connection updates

To stop the application, press `Ctrl+C` for graceful shutdown.

## Output

All console output is automatically saved to `output.log` in the project directory.

The log includes:
- Authentication flow
- Initial connection data from REST API
- WebSocket connection status
- Real-time connection updates from SocketCluster
- Error messages and debugging information

## Connection Data Structure

Each connection object contains:

```json
{
  "id": "917607468256231426",
  "sourceId": "812135592439185410",
  "targetId": null,
  "state": "STOPPED",
  "isStarted": true,
  "parameters": {
    "videoSources": ["RYZEN1 (vMix - Output 1)"],
    "protocol": "WEBRTC_TX",
    "webrtc": {
      "bitrate": 5000000,
      "codec": "VP9",
      "groupId": "810590607821897730"
    }
  },
  "error": "",
  "trial": false
}
```

## API Endpoints Used

- `POST /api/login` - Authenticate and establish session
- `GET /api/connections` - Fetch current connections
- `GET /api/load-token` - Get JWT token for WebSocket auth
- `WSS /socketcluster/` - WebSocket connection endpoint

## Channel Subscriptions

Currently subscribed to:
- `/connections/{ORG_ID}` - Real-time connection updates

Available but commented out:
- `/endpoints/{ORG_ID}` - Device/endpoint information

## Message Types

WebSocket messages include a `msg` field indicating the type:

- `init` - Initial data payload with full connection list
- `update` - Individual connection update
- Other types may include add, remove, etc.

## Project Structure

```
socketcluster-birddog-test/
├── index.js           # Main application file
├── package.json       # Node.js dependencies
├── package-lock.json  # Dependency lock file
├── .gitignore         # Git ignore rules
├── output.log         # Generated log file (gitignored)
└── README.md          # This file
```

## Dependencies

- `socketcluster-client` (^19.2.7) - SocketCluster WebSocket client
- Node.js built-in modules: `fs`

## Troubleshooting

### JWT Token Expiration

The JWT tokens from `/api/load-token` expire after ~3 seconds. The application handles this by:
- Storing session cookies globally
- Requesting a fresh token immediately before WebSocket authentication
- Automatic reconnection on disconnect

### Authentication Failed

If you see "jwt expired" errors:
- The application will automatically request a fresh token
- Check that your session cookies are valid
- Ensure credentials are correct

### Connection Blocked

If subscriptions fail with "SilentMiddlewareBlockedError":
- Verify JWT token is being sent correctly
- Check that the organization ID is correct
- Ensure you have permissions for the requested channel

### Socket Hung Up (1006)

This is normal during reconnection attempts. The application will automatically reconnect.

## Development

To modify the channels subscribed:

```javascript
const CHANNELS_TO_SUBSCRIBE = [
  `/connections/${ORG_ID}`,
  // `/endpoints/${ORG_ID}`,  // Uncomment to enable
];
```

To disable logging to file, comment out the log override section in `index.js`.

## License

ISC

## Author

Nic Cabunilas (necabunilas@gmail.com)

## Repository

https://github.com/nic-birddog/sc-implementation-birddog.git

## Notes

- This is a test/demo client for development purposes
- Contains hardcoded credentials (update for production use)
- Output logs may contain sensitive data
- The application maintains persistent WebSocket connection until manually stopped