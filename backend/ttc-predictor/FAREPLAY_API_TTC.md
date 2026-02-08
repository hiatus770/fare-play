# FarePlay TTC API Documentation

## Overview

The FarePlay TTC API provides real-time transit predictions and historical accuracy data for Toronto Transit Commission (TTC) vehicles. The system continuously monitors vehicle predictions, records "frozen" predictions at specific timestamps, verifies actual arrivals by tracking vehicles between stops, and provides comparison data showing how accurate predictions are.

**Current Status**: ✓ Operational
**API Server**: http://localhost:5000
**Database**: SQLite (ttc_predictions.db)
**Collector**: Running continuously (collector_daemon.py)

---

## Architecture

### System Components

1. **Collector Daemon** (`collector_daemon.py:1-300`)
   - Runs continuously every 10 seconds
   - Fetches predictions from TTC NextBus API for configured routes/stops
   - Records "frozen" predictions at different time windows (0-5min, 5-10min, 10-20min, 20-30min)
   - Verifies arrivals by tracking vehicles from one stop to the next
   - Stores data in SQLite database

2. **Database** (`database.py:1-350`)
   - SQLite backend with 4 main tables:
     - `frozen_predictions` - snapshots of predictions at specific times
     - `verified_arrivals` - actual arrival data with comparison to frozen predictions
     - `routes_stops` - route/stop metadata
     - `statistics_cache` - pre-calculated statistics

3. **REST API** (`api_v2.py:1-290`)
   - Flask server on port 5000
   - Provides endpoints for querying current predictions and historical data
   - Combines real-time TTC API data with historical frozen predictions

### Data Flow

```
TTC API (NextBus)
    ↓
Collector Daemon (fetches every 10s)
    ↓
- Records frozen predictions (database.py:110-133)
- Verifies arrivals at next stops (collector_daemon.py:150-250)
    ↓
Database (SQLite)
    ↓
REST API (api_v2.py)
    ↓
Frontend / Client Applications
```

---

## API Endpoints

### 1. Get Current Predictions + Historical Data

**Endpoint**: `GET /stop/<route>/<stop>`

**Purpose**: Get current vehicles arriving at a stop AND historical prediction accuracy for that stop

**Code Reference**: `api_v2.py:72-135`

**Parameters**:
- `route` (string, required) - TTC route tag (e.g., "501", "503")
- `stop` (string, required) - TTC stop tag (e.g., "24211")

**Response**:
```json
{
  "timestamp": "2026-02-07T18:09:07.566059",
  "route": "503",
  "stop": "24211",
  "route_name": "503-King",
  "stop_name": "York St At King St West North Side",

  "current_predictions": [
    {
      "vehicle_id": "8806",
      "current_eta_seconds": 31,
      "current_eta_display": "0m 31s",
      "direction": "West - 503 Kingston Rd Replacment Bus towards York via Queen and Parliment",
      "recorded_at": "2026-02-07T18:09:07.299946"
    },
    {
      "vehicle_id": "3233",
      "current_eta_seconds": 1414,
      "current_eta_display": "23m 34s",
      "direction": "West - 503 Kingston Rd Replacment Bus towards York via Queen and Parliment",
      "recorded_at": "2026-02-07T18:09:07.299959"
    }
  ],

  "frozen_predictions_history": [
    {
      "vehicle_id": "8806",
      "frozen_at": "2026-02-07 23:08:52",
      "frozen_prediction_seconds": 42,
      "frozen_prediction_display": "0m 42s",
      "actual_elapsed_seconds": 24.147484,
      "actual_elapsed_display": "0m 24s",
      "error_seconds": -17.852516,
      "error_display": "-18s",
      "status": "EARLY"
    }
  ]
}
```

**Usage in Frontend**:

1. **Display Current Vehicles**:
   ```javascript
   // Show what's coming now
   currentPredictions.forEach(pred => {
     console.log(`${pred.vehicle_id}: ${pred.current_eta_display}`);
   });
   // Output:
   // 8806: 0m 31s
   // 3233: 23m 34s
   ```

2. **Show Historical Accuracy**:
   ```javascript
   // For vehicles that already arrived, show how accurate the prediction was
   frozenHistory.forEach(hist => {
     const wasEarly = hist.error_display.startsWith('-');
     console.log(`Vehicle ${hist.vehicle_id}: Predicted ${hist.frozen_prediction_display},
                  Actual ${hist.actual_elapsed_display} (${hist.status})`);
   });
   // Output:
   // Vehicle 8806: Predicted 0m 42s, Actual 0m 24s (EARLY)
   ```

**Frontend Integration Notes**:
- Use `current_predictions` to show "Next Vehicles" list
- Use `frozen_predictions_history` to show past accuracy (optional detailed view)
- `current_eta_display` is formatted MM:SS for easy display
- `error_display` shows if vehicle was early (-) or late (+)
- Only recent history (last 1 hour) is included

---

### 2. List All Stops on a Route

**Endpoint**: `GET /route/<route>/stops`

**Purpose**: Get all stops on a route for navigation/selection

**Code Reference**: `api_v2.py:137-167`

**Parameters**:
- `route` (string, required) - TTC route tag (e.g., "501", "503")

**Response**:
```json
{
  "route": "501",
  "route_name": "501-Queen",
  "total_stops": 179,
  "stops": [
    {
      "tag": "1750",
      "title": "Long Branch Loop",
      "link": "/stop/501/1750"
    },
    {
      "tag": "1073",
      "title": "Lake Shore Blvd West At Thirty Seventh St",
      "link": "/stop/501/1073"
    },
    {
      "tag": "4736",
      "title": "Lake Shore Blvd West At Long Branch Ave",
      "link": "/stop/501/4736"
    }
  ]
}
```

**Usage in Frontend**:

```javascript
// Build a stop selector
fetch('/route/501/stops')
  .then(r => r.json())
  .then(data => {
    const stopSelector = document.getElementById('stops');
    data.stops.forEach(stop => {
      const option = document.createElement('option');
      option.value = stop.tag;
      option.textContent = stop.title;
      stopSelector.appendChild(option);
    });
  });

// When user selects a stop, fetch predictions
stopSelector.addEventListener('change', (e) => {
  const stopTag = e.target.value;
  fetch(`/stop/501/${stopTag}`)
    .then(r => r.json())
    .then(data => displayPredictions(data));
});
```

---

### 3. Compare Vehicle Prediction vs Actual

**Endpoint**: `GET /compare/<route>/<stop>/<vehicle>`

**Purpose**: Compare what was predicted for a specific vehicle at a specific stop vs what actually happened

**Code Reference**: `api_v2.py:169-229`

**Parameters**:
- `route` (string, required) - TTC route tag
- `stop` (string, required) - TTC stop tag
- `vehicle` (string, required) - Vehicle ID

**Response**:
```json
{
  "timestamp": "2026-02-07T18:09:12.596299",
  "route": "503",
  "stop": "24211",
  "vehicle_id": "8806",

  "current_prediction": {
    "seconds": 44,
    "display": "0m 44s",
    "direction": "West - 503 Kingston Rd Replacment Bus towards York via Queen and Parliment",
    "recorded_at": "2026-02-07T18:09:12.593769"
  },

  "frozen_prediction": {
    "frozen_at": "2026-02-07 23:08:52",
    "predicted_seconds": 42,
    "predicted_display": "0m 42s",
    "actual_arrival": 24.147484,
    "actual_arrival_display": "0m 24s",
    "error": -17.852516,
    "error_display": "-18s",
    "status": "EARLY"
  },

  "comparison": {
    "originally_predicted": 42,
    "actually_took": 24,
    "difference": -17.852516,
    "difference_display": "-18s",
    "was_early": true,
    "was_late": false,
    "was_on_time": false
  }
}
```

**Usage in Frontend**:

```javascript
// Show detailed prediction accuracy for a specific vehicle
fetch(`/compare/503/24211/8806`)
  .then(r => r.json())
  .then(data => {
    const comparison = data.comparison;

    if (comparison) {
      const verdict = `Vehicle #${data.vehicle_id} was
                       ${comparison.difference_display}
                       ${comparison.was_early ? 'EARLY' : 'LATE'}`;
      console.log(verdict);
      // Output: Vehicle #8806 was -18s EARLY

      // Show prediction vs reality
      console.log(`Prediction: ${data.frozen_prediction.predicted_display}`);
      console.log(`Reality: ${data.frozen_prediction.actual_arrival_display}`);
      // Output:
      // Prediction: 0m 42s
      // Reality: 0m 24s
    }
  });
```

---

### 4. Historical Predictions for a Stop

**Endpoint**: `GET /history/<route>/<stop>?limit=50`

**Purpose**: Get all frozen predictions for a stop with their actual results

**Code Reference**: `api_v2.py:231-269`

**Parameters**:
- `route` (string, required) - TTC route tag
- `stop` (string, required) - TTC stop tag
- `limit` (integer, optional, default=50) - Max number of records to return

**Response**:
```json
{
  "route": "503",
  "stop": "24211",
  "total_records": 2,
  "history": [
    {
      "vehicle_id": "8806",
      "frozen_at": "2026-02-07 23:08:52",
      "prediction_at_freeze": "0m 42s",
      "seconds": 42,
      "actual_elapsed": "0m 24s",
      "error": "-18s",
      "status": "EARLY",
      "freeze_category": "0-5min",
      "hour": 18,
      "day": "Saturday"
    },
    {
      "vehicle_id": "8806",
      "frozen_at": "2026-02-07 23:07:25",
      "prediction_at_freeze": "1m 47s",
      "seconds": 107,
      "actual_elapsed": "0m 23s",
      "error": "-83s",
      "status": "EARLY",
      "freeze_category": "0-5min",
      "hour": 18,
      "day": "Saturday"
    }
  ]
}
```

**Usage in Frontend**:

```javascript
// Show historical data table
fetch(`/history/503/24211?limit=100`)
  .then(r => r.json())
  .then(data => {
    const table = document.getElementById('history');

    data.history.forEach(record => {
      const row = table.insertRow();
      row.insertCell(0).textContent = record.vehicle_id;
      row.insertCell(1).textContent = record.prediction_at_freeze;
      row.insertCell(2).textContent = record.actual_elapsed;
      row.insertCell(3).textContent = record.error;
      row.insertCell(4).textContent = record.status;
      row.insertCell(5).textContent = `${record.hour}:00`;
      row.insertCell(6).textContent = record.day;
    });
  });
```

**Analysis Example**:
```javascript
// Find average accuracy for a stop
fetch(`/history/503/24211?limit=100`)
  .then(r => r.json())
  .then(data => {
    const errors = data.history.map(h => parseInt(h.error));
    const avgError = errors.reduce((a,b) => a+b) / errors.length;
    const earlyCount = data.history.filter(h => h.status === 'EARLY').length;
    const lateCount = data.history.filter(h => h.status === 'LATE').length;

    console.log(`Stop 24211 accuracy:`);
    console.log(`  Average error: ${avgError.toFixed(0)}s`);
    console.log(`  Early: ${earlyCount}, Late: ${lateCount}`);
  });
```

---

### 5. API Health Check

**Endpoint**: `GET /health`

**Purpose**: Check API status and database statistics

**Code Reference**: `api_v2.py:271-279`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-07T18:10:49.172562",
  "database": {
    "frozen_predictions": 45,
    "verified_arrivals": 3,
    "route_stops": 0,
    "routes": 0
  }
}
```

**Usage in Frontend**:
```javascript
// Monitor system health
setInterval(() => {
  fetch('/health')
    .then(r => r.json())
    .then(data => {
      if (data.status === 'healthy') {
        console.log(`DB: ${data.database.frozen_predictions} predictions,
                     ${data.database.verified_arrivals} verified arrivals`);
      } else {
        console.error('API health check failed');
      }
    });
}, 30000); // Every 30 seconds
```

---

## Configuration

### Collector Configuration

**File**: `collector_config.json`

**Code Reference**: `collector_daemon.py:30-50`

```json
{
  "routes": [
    {
      "tag": "501",
      "name": "Queen Streetcar",
      "stops": ["1750", "5479", "6435"],
      "enabled": true,
      "notes": "Stops ~5-10 minutes apart along Lake Shore Blvd"
    },
    {
      "tag": "503",
      "name": "King Streetcar",
      "stops": ["24211", "2501", "1301"],
      "enabled": true,
      "notes": "Stops ~5-10 minutes apart along King/Queen corridor"
    }
  ],
  "update_interval": 10,
  "max_prediction_age": 1800
}
```

**Key Parameters**:
- `update_interval`: Seconds between collection cycles (10s recommended)
- `max_prediction_age`: Max age of predictions to track (1800s = 30 minutes)
- Stops must be 5-10+ minutes apart for accurate verification

---

## Database Schema

### frozen_predictions Table

**Code Reference**: `database.py:26-41`

Stores snapshots of predictions at specific times.

```sql
CREATE TABLE frozen_predictions (
  id INTEGER PRIMARY KEY,
  timestamp DATETIME,
  vehicle_id TEXT,
  route TEXT,
  stop_from TEXT,
  frozen_prediction_seconds INTEGER,
  freeze_category TEXT,  -- "0-5min", "5-10min", "10-20min", "20-30min"
  hour_of_day INTEGER,
  day_of_week TEXT,
  created_at DATETIME,
  UNIQUE(vehicle_id, route, stop_from, timestamp)
)
```

### verified_arrivals Table

**Code Reference**: `database.py:44-65`

Stores actual arrival times and comparison to frozen predictions.

```sql
CREATE TABLE verified_arrivals (
  id INTEGER PRIMARY KEY,
  vehicle_id TEXT,
  route TEXT,
  stop_from TEXT,
  stop_to TEXT,
  frozen_prediction_seconds INTEGER,
  time_elapsed_seconds REAL,
  actual_error_seconds REAL,
  status TEXT,  -- "EARLY", "LATE", "ON_TIME"
  hour_of_day INTEGER,
  day_of_week TEXT,
  created_at DATETIME
)
```

---

## Frontend Implementation Guide

### Step 1: Display Stop Selection

```html
<div id="route-selector">
  <select id="route">
    <option value="501">501-Queen</option>
    <option value="503">503-King</option>
  </select>
</div>

<div id="stop-selector">
  <select id="stop"></select>
</div>
```

```javascript
document.getElementById('route').addEventListener('change', async (e) => {
  const route = e.target.value;
  const response = await fetch(`/route/${route}/stops`);
  const data = await response.json();

  const stopSelect = document.getElementById('stop');
  stopSelect.innerHTML = '';
  data.stops.forEach(stop => {
    const option = document.createElement('option');
    option.value = stop.tag;
    option.textContent = stop.title;
    stopSelect.appendChild(option);
  });
});
```

### Step 2: Display Current Predictions

```html
<div id="predictions">
  <h3>Next Vehicles</h3>
  <table>
    <thead>
      <tr>
        <th>Vehicle</th>
        <th>Arriving In</th>
        <th>Direction</th>
      </tr>
    </thead>
    <tbody id="current-predictions"></tbody>
  </table>
</div>
```

```javascript
async function updatePredictions(route, stop) {
  const response = await fetch(`/stop/${route}/${stop}`);
  const data = await response.json();

  const tbody = document.getElementById('current-predictions');
  tbody.innerHTML = '';

  data.current_predictions.forEach(pred => {
    const row = tbody.insertRow();
    row.insertCell(0).textContent = pred.vehicle_id;
    row.insertCell(1).textContent = pred.current_eta_display;
    row.insertCell(2).textContent = pred.direction;
  });
}

// Update every 30 seconds
setInterval(() => {
  const route = document.getElementById('route').value;
  const stop = document.getElementById('stop').value;
  if (route && stop) updatePredictions(route, stop);
}, 30000);
```

### Step 3: Show Historical Accuracy (Optional)

```html
<div id="history">
  <h3>Past Predictions (Accuracy)</h3>
  <table>
    <thead>
      <tr>
        <th>Vehicle</th>
        <th>Predicted</th>
        <th>Actual</th>
        <th>Error</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody id="history-table"></tbody>
  </table>
</div>
```

```javascript
async function updateHistory(route, stop) {
  const response = await fetch(`/history/${route}/${stop}?limit=20`);
  const data = await response.json();

  const tbody = document.getElementById('history-table');
  tbody.innerHTML = '';

  if (data.history) {
    data.history.forEach(record => {
      const row = tbody.insertRow();
      row.insertCell(0).textContent = record.vehicle_id;
      row.insertCell(1).textContent = record.prediction_at_freeze;
      row.insertCell(2).textContent = record.actual_elapsed;
      row.insertCell(3).textContent = record.error;

      const statusCell = row.insertCell(4);
      statusCell.textContent = record.status;
      statusCell.className = record.status === 'EARLY' ? 'early' :
                             record.status === 'LATE' ? 'late' : 'on-time';
    });
  }
}
```

---

## Interpretation Guide

### Reading the Data

**Current Predictions**:
- Show the next vehicles and their ETAs
- Update frequently (every 30s or on user request)
- Use `current_eta_display` for user display

**Frozen Predictions History**:
- Show past predictions and how accurate they were
- `frozen_prediction_display` = what was predicted
- `actual_elapsed_display` = what actually happened
- `error_display` = the difference (negative = early, positive = late)

**Example**: If a prediction shows "Predicted 0m 42s, Actual 0m 24s, Error -18s"
- The system predicted 42 seconds
- The vehicle actually arrived in 24 seconds
- It was 18 seconds **earlier** than predicted

### Status Values

- `EARLY`: Vehicle arrived 15+ seconds before predicted
- `LATE`: Vehicle arrived 15+ seconds after predicted
- `ON_TIME`: Within ±15 seconds of prediction

---

## Error Handling

### No Predictions Available

**Response**: HTTP 404
```json
{
  "error": "No predictions available for this route/stop",
  "route": "501",
  "stop": "9999"
}
```

**Frontend Handling**:
```javascript
fetch(`/stop/${route}/${stop}`)
  .then(r => {
    if (!r.ok) return r.json().then(d => { throw new Error(d.error); });
    return r.json();
  })
  .catch(err => {
    console.error('Error:', err.message);
    document.getElementById('predictions').textContent =
      'No data available for this stop. Try another location.';
  });
```

### API Not Responding

```javascript
async function safeApiCall(url, fallback = null) {
  try {
    const response = await fetch(url, { timeout: 5000 });
    return await response.json();
  } catch (err) {
    console.error(`API call failed: ${err}`);
    return fallback;
  }
}
```

---

## Performance Considerations

1. **Cache Stop Lists**: Get `/route/<route>/stops` once per session
2. **Update Predictions**: Every 30-60 seconds (not too frequently)
3. **History Data**: Load only when user requests (limit=20 by default)
4. **Health Check**: Every 60 seconds to monitor API status

**Sample Cache Implementation**:
```javascript
const cache = {};

async function getStops(route) {
  if (!cache[route]) {
    const response = await fetch(`/route/${route}/stops`);
    cache[route] = await response.json();
  }
  return cache[route];
}
```

---

## Code References Summary

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Current Predictions | `api_v2.py` | 72-135 | GET /stop/<route>/<stop> |
| Route Stops | `api_v2.py` | 137-167 | GET /route/<route>/stops |
| Vehicle Comparison | `api_v2.py` | 169-229 | GET /compare/<route>/<stop>/<vehicle> |
| History | `api_v2.py` | 231-269 | GET /history/<route>/<stop> |
| Health | `api_v2.py` | 271-279 | GET /health |
| Collector Daemon | `collector_daemon.py` | 1-300 | Background data collection |
| Database | `database.py` | 1-350 | Data persistence |
| Configuration | `collector_config.json` | - | Routes and stops to monitor |

---

## Testing the API

```bash
# Health check
curl http://localhost:5000/health

# List stops on route 503
curl http://localhost:5000/route/503/stops

# Get predictions for a stop
curl http://localhost:5000/stop/503/24211

# Get history for a stop
curl http://localhost:5000/history/503/24211?limit=20

# Compare specific vehicle
curl http://localhost:5000/compare/503/24211/8806

# Pretty print JSON
curl http://localhost:5000/health | python3 -m json.tool
```

---

## Future Enhancements

1. **Predictive Analysis**: Use historical data to predict early/late patterns by time of day
2. **Route Analysis**: Compare accuracy across different routes
3. **Vehicle Specific**: Track individual vehicle performance
4. **Alerts**: Notify when vehicles are consistently late/early
5. **WebSocket Support**: Real-time updates instead of polling
6. **Caching**: Redis for faster historical queries

