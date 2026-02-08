#!/usr/bin/env python3
"""
TTC Real-Time API v2
Focus: Real-time current status + frozen predictions history
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import requests
import xml.etree.ElementTree as ET
from database import PredictionDB

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
db = PredictionDB()

NEXTBUS_BASE_URL = "https://webservices.nextbus.com/service/publicXMLFeed"
AGENCY = "ttc"

def get_current_predictions(route_tag, stop_tag):
    """Get CURRENT predictions from TTC API"""
    try:
        params = {
            'command': 'predictions',
            'a': AGENCY,
            'r': route_tag,
            's': stop_tag,
        }
        response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
        root = ET.fromstring(response.content)

        predictions = {}
        for direction in root.findall('.//direction'):
            for prediction in direction.findall('.//prediction'):
                vehicle_id = prediction.get('vehicle')
                predictions[vehicle_id] = {
                    'vehicle_id': vehicle_id,
                    'seconds': int(prediction.get('seconds', 0)),
                    'minutes': int(prediction.get('minutes', 0)),
                    'direction': direction.get('title'),
                    'timestamp': datetime.now(),
                }

        return predictions
    except:
        return {}

def get_route_stop_info(route_tag, stop_tag):
    """Get route and stop name info"""
    try:
        params = {
            'command': 'routeConfig',
            'a': AGENCY,
            'r': route_tag,
        }
        response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
        root = ET.fromstring(response.content)

        route_name = root.find('.//route').get('title')

        for stop in root.findall('.//stop'):
            if stop.get('tag') == stop_tag:
                return {
                    'route_tag': route_tag,
                    'route_name': route_name,
                    'stop_tag': stop_tag,
                    'stop_name': stop.get('title'),
                }
        return None
    except:
        return None

@app.route('/stop/<route>/<stop>', methods=['GET'])
def get_stop_status(route, stop):
    """
    Get CURRENT status for a stop
    Shows: next vehicles + their current predictions
    """
    # Get current predictions
    current_preds = get_current_predictions(route, stop)

    if not current_preds:
        return jsonify({
            'error': 'No predictions available for this route/stop',
            'route': route,
            'stop': stop
        }), 404

    # Get route/stop info
    info = get_route_stop_info(route, stop)

    # Get frozen predictions from database for comparison
    frozen_preds = db.get_raw_arrivals(route=route, stop=stop)

    # Build response with current + frozen data
    response = {
        'timestamp': datetime.now().isoformat(),
        'route': route,
        'stop': stop,
        'route_name': info['route_name'] if info else 'Unknown',
        'stop_name': info['stop_name'] if info else 'Unknown',

        'current_predictions': [],
        'frozen_predictions_history': []
    }

    # Current predictions (next vehicles)
    for vehicle_id in sorted(current_preds.keys()):
        pred = current_preds[vehicle_id]
        response['current_predictions'].append({
            'vehicle_id': vehicle_id,
            'current_eta_seconds': pred['seconds'],
            'current_eta_display': f"{pred['minutes']}m {pred['seconds']%60}s",
            'direction': pred['direction'],
            'recorded_at': pred['timestamp'].isoformat(),
        })

    # Frozen predictions history (past predictions for comparison)
    recent_frozen = [f for f in frozen_preds if
                     (datetime.now() - datetime.fromisoformat(f['created_at'].replace(' ', 'T'))).total_seconds() < 3600]

    for frozen in recent_frozen[:10]:  # Last 10
        response['frozen_predictions_history'].append({
            'vehicle_id': frozen['vehicle_id'],
            'frozen_at': frozen['created_at'],
            'frozen_prediction_seconds': frozen['frozen_prediction_seconds'],
            'frozen_prediction_display': f"{frozen['frozen_prediction_seconds']//60}m {frozen['frozen_prediction_seconds']%60}s",
            'time_elapsed_since': datetime.now().isoformat(),
            'actual_elapsed_seconds': frozen['time_elapsed_seconds'],
            'actual_elapsed_display': f"{int(frozen['time_elapsed_seconds']//60)}m {int(frozen['time_elapsed_seconds']%60)}s",
            'error_seconds': frozen['actual_error_seconds'],
            'error_display': f"{frozen['actual_error_seconds']:+.0f}s",
            'status': frozen['status'],
        })

    return jsonify(response)

@app.route('/route/<route>/stops', methods=['GET'])
def list_route_stops(route):
    """List all stops on a route with their coordinates"""
    try:
        params = {
            'command': 'routeConfig',
            'a': AGENCY,
            'r': route,
        }
        response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
        root = ET.fromstring(response.content)

        route_info = root.find('.//route')

        stops = []
        seen_tags = set()  # Avoid duplicates
        for stop in root.findall('.//stop'):
            tag = stop.get('tag')
            if stop.get('lat') and stop.get('lon') and tag not in seen_tags:
                seen_tags.add(tag)
                stops.append({
                    'tag': tag,
                    'title': stop.get('title'),
                    'lat': float(stop.get('lat')),
                    'lon': float(stop.get('lon')),
                    'stopId': stop.get('stopId'),
                    'link': f"/stop/{route}/{tag}",
                })

        return jsonify({
            'route': route,
            'route_name': route_info.get('title'),
            'color': route_info.get('color'),
            'total_stops': len(stops),
            'stops': stops
        })
    except:
        return jsonify({'error': 'Could not fetch route'}), 404

@app.route('/compare/<route>/<stop>/<vehicle>', methods=['GET'])
def compare_predictions(route, stop, vehicle):
    """
    Compare frozen prediction vs current prediction for a vehicle
    Shows: what was predicted X min ago vs what's predicted now
    """
    # Get current prediction
    current_preds = get_current_predictions(route, stop)
    current = current_preds.get(vehicle)

    # Get frozen predictions from history
    frozen_list = db.get_raw_arrivals(route=route, stop=stop)
    frozen = next((f for f in frozen_list if f['vehicle_id'] == vehicle), None)

    if not current and not frozen:
        return jsonify({'error': 'Vehicle not found'}), 404

    response = {
        'timestamp': datetime.now().isoformat(),
        'route': route,
        'stop': stop,
        'vehicle_id': vehicle,

        'current_prediction': None,
        'frozen_prediction': None,
        'comparison': None,
    }

    if current:
        response['current_prediction'] = {
            'seconds': current['seconds'],
            'display': f"{current['minutes']}m {current['seconds']%60}s",
            'direction': current['direction'],
            'recorded_at': current['timestamp'].isoformat(),
        }

    if frozen:
        response['frozen_prediction'] = {
            'frozen_at': frozen['created_at'],
            'predicted_seconds': frozen['frozen_prediction_seconds'],
            'predicted_display': f"{frozen['frozen_prediction_seconds']//60}m {frozen['frozen_prediction_seconds']%60}s",
            'elapsed_since_frozen': (datetime.now() - datetime.fromisoformat(frozen['created_at'].replace(' ', 'T'))).total_seconds(),
            'actual_arrival': frozen['time_elapsed_seconds'],
            'actual_arrival_display': f"{int(frozen['time_elapsed_seconds']//60)}m {int(frozen['time_elapsed_seconds']%60)}s",
            'error': frozen['actual_error_seconds'],
            'error_display': f"{frozen['actual_error_seconds']:+.0f}s",
            'status': frozen['status'],
        }

        # Show the progress
        response['comparison'] = {
            'originally_predicted': frozen['frozen_prediction_seconds'],
            'actually_took': frozen['time_elapsed_seconds'],
            'difference': frozen['actual_error_seconds'],
            'difference_display': f"{frozen['actual_error_seconds']:+.0f}s",
            'was_late': frozen['actual_error_seconds'] > 15,
            'was_early': frozen['actual_error_seconds'] < -15,
            'was_on_time': abs(frozen['actual_error_seconds']) <= 15,
        }

    return jsonify(response)

@app.route('/history/<route>/<stop>', methods=['GET'])
def get_history(route, stop):
    """
    Get frozen prediction history for a stop
    Shows all frozen predictions recorded for this stop over time
    """
    limit = request.args.get('limit', 50, type=int)

    frozen_list = db.get_raw_arrivals(route=route, stop=stop)

    if not frozen_list:
        return jsonify({
            'error': 'No history for this stop',
            'route': route,
            'stop': stop
        }), 404

    response = {
        'route': route,
        'stop': stop,
        'total_records': len(frozen_list),
        'history': []
    }

    for record in frozen_list[:limit]:
        response['history'].append({
            'vehicle_id': record['vehicle_id'],
            'frozen_at': record['created_at'],
            'prediction_at_freeze': f"{record['frozen_prediction_seconds']//60}m {record['frozen_prediction_seconds']%60}s",
            'seconds': record['frozen_prediction_seconds'],
            'actual_elapsed': f"{int(record['time_elapsed_seconds']//60)}m {int(record['time_elapsed_seconds']%60)}s",
            'error': f"{record['actual_error_seconds']:+.0f}s",
            'status': record['status'],
            'freeze_category': record['freeze_category'],
            'hour': record['hour_of_day'],
            'day': record['day_of_week'],
        })

    return jsonify(response)

@app.route('/routes', methods=['GET'])
def list_all_routes():
    """Get all available TTC routes"""
    try:
        params = {
            'command': 'routeList',
            'a': AGENCY,
        }
        response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
        root = ET.fromstring(response.content)

        routes = []
        for route in root.findall('.//route'):
            route_tag = route.get('tag')
            route_name = route.get('title')
            if route_tag and route_name:
                routes.append({
                    'tag': route_tag,
                    'name': route_name,
                })

        routes.sort(key=lambda r: r['tag'])
        return jsonify({
            'total_routes': len(routes),
            'routes': routes,
        })
    except Exception as e:
        return jsonify({'error': f'Could not fetch routes: {str(e)}'}), 500

@app.route('/routes/stops', methods=['GET'])
def get_routes_stops():
    """Get stops for multiple routes at once (comma-separated route tags)"""
    try:
        routes_param = request.args.get('routes', '', type=str)
        if not routes_param:
            return jsonify({'error': 'routes parameter required (comma-separated)'}), 400

        route_tags = [r.strip() for r in routes_param.split(',')]

        all_stops = {}
        route_info = {}

        for route_tag in route_tags:
            params = {
                'command': 'routeConfig',
                'a': AGENCY,
                'r': route_tag,
            }
            try:
                response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
                root = ET.fromstring(response.content)

                route_elem = root.find('.//route')
                if route_elem is not None:
                    route_info[route_tag] = {
                        'name': route_elem.get('title'),
                        'color': route_elem.get('color'),
                    }

                for stop in root.findall('.//stop'):
                    tag = stop.get('tag')
                    lat = stop.get('lat')
                    lon = stop.get('lon')

                    if tag and lat and lon:
                        if tag not in all_stops:
                            all_stops[tag] = {
                                'tag': tag,
                                'title': stop.get('title'),
                                'lat': float(lat),
                                'lon': float(lon),
                                'stopId': stop.get('stopId'),
                                'routes': [],
                            }
                        if route_tag not in all_stops[tag]['routes']:
                            all_stops[tag]['routes'].append(route_tag)
            except:
                continue

        stops_list = list(all_stops.values())

        return jsonify({
            'routes': route_info,
            'total_stops': len(stops_list),
            'stops': stops_list,
        })
    except Exception as e:
        return jsonify({'error': f'Could not fetch stops: {str(e)}'}), 500

@app.route('/stops', methods=['GET'])
def get_all_stops():
    """Get all unique stops across all routes (limited to top N)"""
    try:
        limit = request.args.get('limit', 100, type=int)
        params = {
            'command': 'routeList',
            'a': AGENCY,
        }
        response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
        root = ET.fromstring(response.content)

        all_stops = {}

        for route in root.findall('.//route'):
            route_tag = route.get('tag')
            route_name = route.get('title')

            params = {
                'command': 'routeConfig',
                'a': AGENCY,
                'r': route_tag,
            }
            try:
                response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=5)
                route_root = ET.fromstring(response.content)

                for stop in route_root.findall('.//stop'):
                    stop_tag = stop.get('tag')
                    stop_title = stop.get('title')

                    if stop_tag and stop_title:
                        if stop_tag not in all_stops:
                            all_stops[stop_tag] = {
                                'tag': stop_tag,
                                'title': stop_title,
                                'lat': float(stop.get('lat', 0)),
                                'lon': float(stop.get('lon', 0)),
                                'routes': []
                            }

                        if route_tag not in all_stops[stop_tag]['routes']:
                            all_stops[stop_tag]['routes'].append(route_tag)
            except:
                continue

        stops_list = list(all_stops.values())
        stops_list.sort(key=lambda s: s['title'])

        return jsonify({
            'total_stops': len(stops_list),
            'stops': stops_list[:limit]
        })
    except Exception as e:
        return jsonify({'error': f'Could not fetch stops: {str(e)}'}), 500

@app.route('/stops/search', methods=['GET'])
def search_stops():
    """Search for stops by name"""
    try:
        query = request.args.get('q', '', type=str).lower()

        if not query or len(query) < 2:
            return jsonify({'error': 'Query must be at least 2 characters'}), 400

        params = {
            'command': 'routeList',
            'a': AGENCY,
        }
        response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
        root = ET.fromstring(response.content)

        results = []

        for route in root.findall('.//route'):
            route_tag = route.get('tag')
            route_name = route.get('title')

            params = {
                'command': 'routeConfig',
                'a': AGENCY,
                'r': route_tag,
            }
            try:
                response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=5)
                route_root = ET.fromstring(response.content)

                for stop in route_root.findall('.//stop'):
                    stop_title = stop.get('title', '').lower()
                    if query in stop_title:
                        # Check if already in results
                        existing = next((r for r in results if r['tag'] == stop.get('tag')), None)
                        if existing:
                            if route_tag not in existing['routes']:
                                existing['routes'].append(route_tag)
                        else:
                            results.append({
                                'tag': stop.get('tag'),
                                'title': stop.get('title'),
                                'lat': float(stop.get('lat', 0)),
                                'lon': float(stop.get('lon', 0)),
                                'routes': [route_tag],
                            })
            except:
                continue

        return jsonify({
            'query': query,
            'total_results': len(results),
            'stops': results[:50]
        })
    except Exception as e:
        return jsonify({'error': f'Could not search stops: {str(e)}'}), 500

@app.route('/stops/nearby', methods=['GET'])
def get_nearby_stops():
    """Get stops near a location (geolocation)"""
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        radius = request.args.get('radius', default=1, type=float)

        if lat is None or lon is None:
            return jsonify({'error': 'lat and lon required'}), 400

        params = {
            'command': 'routeList',
            'a': AGENCY,
        }
        response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
        root = ET.fromstring(response.content)

        nearby_stops = []

        for route in root.findall('.//route'):
            route_tag = route.get('tag')
            route_name = route.get('title')

            params = {
                'command': 'routeConfig',
                'a': AGENCY,
                'r': route_tag,
            }
            try:
                response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=5)
                route_root = ET.fromstring(response.content)

                for stop in route_root.findall('.//stop'):
                    stop_lat = float(stop.get('lat', 0))
                    stop_lon = float(stop.get('lon', 0))

                    dlat = abs(stop_lat - lat)
                    dlon = abs(stop_lon - lon)
                    distance = ((dlat**2 + dlon**2) ** 0.5) * 111

                    if distance <= radius:
                        existing = next((s for s in nearby_stops if s['tag'] == stop.get('tag')), None)
                        if existing:
                            if route_tag not in existing['routes']:
                                existing['routes'].append(route_tag)
                        else:
                            nearby_stops.append({
                                'tag': stop.get('tag'),
                                'title': stop.get('title'),
                                'lat': stop_lat,
                                'lon': stop_lon,
                                'routes': [route_tag],
                                'distance': round(distance, 2),
                            })
            except:
                continue

        nearby_stops.sort(key=lambda s: s['distance'])

        return jsonify({
            'lat': lat,
            'lon': lon,
            'radius': radius,
            'total_stops': len(nearby_stops),
            'stops': nearby_stops[:100]
        })
    except Exception as e:
        return jsonify({'error': f'Could not fetch nearby stops: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    status = db.get_status()
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'database': status
    })

if __name__ == '__main__':
    print("TTC Real-Time API v2")
    print("Endpoints:")
    print("  GET  /routes                       - List all TTC routes")
    print("  GET  /stops                        - Get all unique stops (limit=100)")
    print("  GET  /stops/search?q=<query>       - Search stops by name")
    print("  GET  /stops/nearby?lat=X&lon=Y     - Get nearby stops by geolocation")
    print("  GET  /stop/<route>/<stop>          - Current status + frozen history")
    print("  GET  /route/<route>/stops          - List stops on route")
    print("  GET  /compare/<route>/<stop>/<vehicle> - Compare frozen vs current")
    print("  GET  /history/<route>/<stop>       - Frozen predictions history")
    print("  GET  /health                       - Health check")
    print()
    app.run(host='0.0.0.0', port=5000, debug=False)
