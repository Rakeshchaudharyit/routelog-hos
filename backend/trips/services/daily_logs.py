from copy import deepcopy
from datetime import date, datetime
import math

DEFAULT_LOG_METADATA = {
    'driver_name': 'Alex Morgan',
    'co_driver_name': None,
    'carrier_name': 'RouteLog Demo Transport',
    'main_office_address': 'Atlanta, GA',
    'vehicle_number': 'TRK-102',
    'shipping_document_number': 'RL-2026-1042',
}
DUTY_STATUSES = ('off_duty', 'sleeper', 'driving', 'on_duty')


class DailyLogError(Exception):
    status_code = 502


def validate_daily_log(log):
    try:
        if date.fromisoformat(log['date']).isoformat() != log['date']:
            raise ValueError('Invalid date.')
        miles = log['distance_miles']
        if isinstance(miles, bool) or not math.isfinite(miles) or miles < 0 or log['total_miles'] != miles:
            raise ValueError('Invalid daily miles.')
        cursor = 0
        totals = dict.fromkeys(DUTY_STATUSES, 0)
        for segment in log['segments']:
            a, b, status = segment['start_seconds'], segment['end_seconds'], segment['status']
            if type(a) is not int or type(b) is not int or a != cursor or not a < b <= 86400 or status not in totals:
                raise ValueError('Invalid duty coverage.')
            totals[status] += b-a
            cursor = b
        if cursor != 86400 or totals != log['totals_seconds'] or log['total_seconds'] != 86400:
            raise ValueError('Daily totals must match complete 24-hour segments.')
        for value in (log['driver']['name'], log['carrier']['name'], log['carrier']['main_office_address'], log['vehicle_number'], log['shipping_document_number']):
            if not isinstance(value, str) or not value.strip():
                raise ValueError('Required log metadata missing.')
        if log['certification']['certified'] is not False or log['certification']['driver_name'] != log['driver']['name'] or log['certification']['status'] != 'planning_record':
            raise ValueError('Planning records must remain uncertified.')
        if any(log['totals'][status] != totals[status]/3600 for status in DUTY_STATUSES):
            raise ValueError('Displayed totals do not match duty seconds.')
    except (KeyError, TypeError, ValueError, OverflowError) as error:
        raise DailyLogError('Generated daily log data is invalid. Please try again.') from error


def prepare_daily_logs(logs, events, metadata=None):
    values = {**DEFAULT_LOG_METADATA, **(metadata or {})}
    result = deepcopy(logs)
    for log in result:
        log.update({
            'driver': {'name': values['driver_name'], 'co_driver_name': values['co_driver_name']},
            'carrier': {'name': values['carrier_name'], 'main_office_address': values['main_office_address']},
            'vehicle_number': values['vehicle_number'],
            'shipping_document_number': values['shipping_document_number'],
            'total_miles': log['distance_miles'],
            'totals': {status: seconds/3600 for status, seconds in log['totals_seconds'].items()},
            'certification': {'driver_name': values['driver_name'], 'certified': False, 'status': 'planning_record'},
        })
        # Include only transitions that start on this calendar date, never midnight copies.
        details = []
        for event in events:
            start = datetime.fromisoformat(event['start'])
            if start.date().isoformat() == log['date']:
                location = event.get('location')
                address = location.get('address') if location else 'En route'
                details.append({'time': start.isoformat(), 'location': address or 'En route',
                                'description': event['description'], 'type': event['type'],
                                'status': event['status']})
        log['remark_details'] = details
        log['remarks'] = [f"{item['location']} — {item['description']}" for item in details]
        validate_daily_log(log)
    return result
