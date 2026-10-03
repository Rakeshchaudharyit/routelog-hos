import hashlib
import json
from .routing import calculate_route
from .hos import HOSPlanner, DEFAULT_START_TIME
from .daily_logs import prepare_daily_logs


def plan_trip(validated_input):
    locations = {key: validated_input[key] for key in (
        'current_location', 'pickup_location', 'dropoff_location')}
    route = calculate_route(list(locations.values()))
    start = validated_input.get('start_time', DEFAULT_START_TIME)
    schedule = HOSPlanner(validated_input['current_cycle_used'], start).schedule(route)
    schedule['daily_logs'] = prepare_daily_logs(schedule['daily_logs'], schedule['events'], validated_input.get('log_metadata'))
    identity = json.dumps({**locations, 'cycle': validated_input['current_cycle_used'], 'start': start.isoformat()}, sort_keys=True)
    return {'trip_id': 'RL-' + hashlib.sha256(identity.encode()).hexdigest()[:8].upper(),
            'status': 'ok', 'hos_status': 'calculated', 'route': route, **schedule,
            'requested_locations': locations,
            'current_cycle_used': validated_input['current_cycle_used'],
            'assumptions': {'qualifying_rest_before_start': True,
                            'schedule_timezone': start.strftime('%z') or 'local fixed schedule time',
                            'rolling_cycle_recapture': False,
                            'fuel_placement': 'approximate_route_position_not_a_station'}}
