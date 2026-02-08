#!/usr/bin/env python3
"""
Collector Daemon - Collect predictions for multiple routes/stops
Runs continuously and stores in database
"""

import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import time
from typing import List, Dict, Tuple
import json
from pathlib import Path
from database import PredictionDB

NEXTBUS_BASE_URL = "http://webservices.nextbus.com/service/publicXMLFeed"
AGENCY = "ttc"

class CollectorDaemon:
    """Collect predictions for multiple routes and stops."""

    def __init__(self, config_file="collector_config.json"):
        self.db = PredictionDB()
        self.config_file = config_file
        self.config = self.load_config()
        self.route_cache = {}  # Cache route configs
        self.tracked_vehicles = {}  # Track vehicles across stops

    def load_config(self) -> Dict:
        """Load collector configuration."""
        if Path(self.config_file).exists():
            with open(self.config_file, 'r') as f:
                return json.load(f)

        # Default config
        default_config = {
            "routes": [
                {
                    "tag": "501",
                    "name": "Queen Streetcar",
                    "stops": ["10294", "4430"],  # Queen & Spadina, Queen & University
                    "enabled": True
                },
                {
                    "tag": "503",
                    "name": "King Streetcar",
                    "stops": ["23885", "23887"],  # King & Yonge, King & Bay
                    "enabled": True
                },
            ],
            "update_interval": 10,  # seconds
            "max_prediction_age": 1800,  # 30 minutes
        }

        with open(self.config_file, 'w') as f:
            json.dump(default_config, f, indent=2)

        return default_config

    def get_route_config(self, route_tag: str) -> Dict:
        """Get route configuration with caching."""
        if route_tag in self.route_cache:
            return self.route_cache[route_tag]

        try:
            params = {
                'command': 'routeConfig',
                'a': AGENCY,
                'r': route_tag,
            }
            response = requests.get(NEXTBUS_BASE_URL, params=params, timeout=10)
            root = ET.fromstring(response.content)

            route = root.find('.//route')
            if route is None:
                return None

            config = {
                'tag': route.get('tag'),
                'title': route.get('title'),
                'stops': {},
                'directions': {},
            }

            # Get all stops
            for stop in root.findall('.//stop'):
                lat_str = stop.get('lat')
                lon_str = stop.get('lon')

                if lat_str and lon_str:
                    config['stops'][stop.get('tag')] = {
                        'title': stop.get('title'),
                        'lat': float(lat_str),
                        'lon': float(lon_str),
                    }

            # Get directions and their stops
            for direction in root.findall('.//direction'):
                dir_tag = direction.get('tag')
                config['directions'][dir_tag] = {
                    'title': direction.get('title'),
                    'stops': [s.get('tag') for s in direction.findall('.//stop')]
                }

            # Cache it
            self.route_cache[route_tag] = config
            return config

        except Exception as e:
            print(f"Error fetching route config for {route_tag}: {e}")
            return None

    def get_next_stop(self, route_tag: str, current_stop: str) -> str:
        """Find the next stop after current stop."""
        config = self.get_route_config(route_tag)
        if not config:
            return None

        # Try to find in first direction
        for dir_tag, dir_info in config['directions'].items():
            stops = dir_info['stops']
            try:
                idx = stops.index(current_stop)
                if idx + 1 < len(stops):
                    return stops[idx + 1]
            except ValueError:
                pass

        return None

    def get_predictions(self, route_tag: str, stop_tag: str) -> Dict:
        """Fetch predictions for a stop."""
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
                        'seconds': int(prediction.get('seconds', 0)),
                        'minutes': int(prediction.get('minutes', 0)),
                        'direction': direction.get('tag'),
                    }

            return predictions
        except Exception as e:
            print(f"Error fetching predictions: {e}")
            return {}

    def categorize_prediction(self, seconds: int) -> str:
        """Categorize prediction by time window."""
        if seconds < 300:
            return "0-5min"
        elif seconds < 600:
            return "5-10min"
        elif seconds < 1200:
            return "10-20min"
        elif seconds < 1800:
            return "20-30min"
        else:
            return "30+min"

    def record_prediction(self, route_tag: str, stop_tag: str, vehicle_id: str,
                         prediction_seconds: int, stop_name: str):
        """Record a frozen prediction."""
        now = datetime.now()
        freeze_category = self.categorize_prediction(prediction_seconds)

        key = f"{route_tag}_{stop_tag}_{vehicle_id}"

        # Store in database
        self.db.add_frozen_prediction(
            vehicle_id=vehicle_id,
            route=route_tag,
            stop=stop_tag,
            stop_name=stop_name,
            prediction_seconds=prediction_seconds,
            freeze_category=freeze_category,
            hour_of_day=now.hour,
            day_of_week=now.strftime('%A')
        )

        # Track for verification
        self.tracked_vehicles[key] = {
            'vehicle_id': vehicle_id,
            'route': route_tag,
            'stop_from': stop_tag,
            'stop_name_from': stop_name,
            'frozen_time': now,
            'prediction_seconds': prediction_seconds,
            'freeze_category': freeze_category,
            'next_stop': self.get_next_stop(route_tag, stop_tag),
        }

    def verify_arrivals(self, route_tag: str):
        """Check if tracked vehicles have arrived at next stops."""
        # Get next stop predictions
        next_stops = {}
        config = self.get_route_config(route_tag)

        if config:
            for stop_tag in config['stops'].keys():
                next_stop = self.get_next_stop(route_tag, stop_tag)
                if next_stop:
                    predictions = self.get_predictions(route_tag, next_stop)
                    next_stops[stop_tag] = (next_stop, predictions)

        # Check tracked vehicles
        now = datetime.now()
        for key in list(self.tracked_vehicles.keys()):
            tracked = self.tracked_vehicles[key]
            time_elapsed = (now - tracked['frozen_time']).total_seconds()

            # Only verify if enough time has passed (within expected window ±2min buffer)
            if time_elapsed < tracked['prediction_seconds'] - 120:
                # Too early - vehicle hasn't had time to reach next stop yet
                continue

            if tracked['stop_from'] in next_stops:
                next_stop, predictions = next_stops[tracked['stop_from']]

                if tracked['vehicle_id'] in predictions:
                    # Vehicle appeared at next stop! VERIFIED ARRIVAL
                    error = time_elapsed - tracked['prediction_seconds']

                    # Classify status
                    if abs(error) <= 15:
                        status = 'ON_TIME'
                    elif error < -15:
                        status = 'EARLY'
                    else:
                        status = 'LATE'

                    # Store in database
                    config = self.get_route_config(route_tag)
                    next_stop_name = config['stops'].get(next_stop, {}).get('title', 'Unknown')

                    self.db.add_verified_arrival(
                        vehicle_id=tracked['vehicle_id'],
                        route=route_tag,
                        stop_from=tracked['stop_from'],
                        stop_to=next_stop,
                        stop_name_from=tracked['stop_name_from'],
                        stop_name_to=next_stop_name,
                        prediction_seconds=tracked['prediction_seconds'],
                        freeze_category=tracked['freeze_category'],
                        time_elapsed=time_elapsed,
                        error_seconds=error,
                        hour_of_day=now.hour,
                        day_of_week=now.strftime('%A'),
                        status=status
                    )

                    print(f"✓ Verified: {tracked['vehicle_id']} ({tracked['freeze_category']}) "
                          f"Predicted: {tracked['prediction_seconds']:.0f}s, "
                          f"Actual: {time_elapsed:.0f}s, "
                          f"Error: {error:+.0f}s ({status})")

                    del self.tracked_vehicles[key]

            # Remove old tracked vehicles (older than 2x the prediction + 10min buffer)
            max_age = max(tracked['prediction_seconds'] * 2 + 600, 3600)  # At least 1 hour
            if time_elapsed > max_age:
                print(f"⏱️  Timeout: {tracked['vehicle_id']} ({tracked['freeze_category']}) - "
                      f"never appeared at next stop after {time_elapsed:.0f}s")
                del self.tracked_vehicles[key]

    def run(self, duration_seconds: int = None):
        """Run the collector daemon."""
        print("TTC Collector Daemon Started")
        print(f"Config: {self.config_file}")
        print(f"Update interval: {self.config['update_interval']}s\n")

        start_time = datetime.now()
        iteration = 0

        try:
            while True:
                iteration += 1

                for route_config in self.config['routes']:
                    if not route_config.get('enabled', True):
                        continue

                    route_tag = route_config['tag']
                    route_name = route_config['name']

                    # Collect for each stop
                    for stop_tag in route_config['stops']:
                        config = self.get_route_config(route_tag)
                        if config and stop_tag in config['stops']:
                            stop_name = config['stops'][stop_tag]['title']

                            # Get predictions
                            predictions = self.get_predictions(route_tag, stop_tag)

                            # Record each vehicle
                            for vehicle_id, pred in predictions.items():
                                self.record_prediction(
                                    route_tag, stop_tag, vehicle_id,
                                    pred['seconds'], stop_name
                                )

                    # Verify arrivals
                    self.verify_arrivals(route_tag)

                # Periodically update statistics
                if iteration % 12 == 0:  # Every 2 minutes (12 * 10s)
                    self.db.update_statistics_cache()

                print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                      f"Iteration {iteration} - "
                      f"Tracked: {len(self.tracked_vehicles)} vehicles - "
                      f"DB: {self.db.get_status()['verified_arrivals']} verifications")

                # Check duration
                if duration_seconds:
                    elapsed = (datetime.now() - start_time).total_seconds()
                    if elapsed > duration_seconds:
                        break

                time.sleep(self.config['update_interval'])

        except KeyboardInterrupt:
            print("\n\nDaemon stopped by user")

        print(f"\nFinal status:")
        status = self.db.get_status()
        for key, value in status.items():
            print(f"  {key}: {value}")


def main():
    """Run the daemon."""
    daemon = CollectorDaemon()
    daemon.run()


if __name__ == "__main__":
    main()
