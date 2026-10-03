from datetime import datetime, time, timedelta
import math
from .route_progress import RouteProgress

MAX_DRIVING_SECONDS = 11 * 3600
DUTY_WINDOW_SECONDS = 14 * 3600
BREAK_TRIGGER_DRIVING_SECONDS = 8 * 3600
BREAK_DURATION_SECONDS = 30 * 60
DAILY_REST_SECONDS = 10 * 3600
CYCLE_LIMIT_SECONDS = 70 * 3600
CYCLE_RESTART_SECONDS = 34 * 3600
FUEL_INTERVAL_MILES = 1000
FUEL_DURATION_SECONDS = 30 * 60
SERVICE_SECONDS = 3600
DEFAULT_START_TIME = datetime(2026, 10, 5, 6)


def driving_dates(start, end):
    if end <= start:
        return set()
    last = (end - timedelta(microseconds=1)).date()
    return {start.date() + timedelta(days=n) for n in range((last - start.date()).days + 1)}


class HOSPlanner:
    def __init__(self, cycle_used, start_time=DEFAULT_START_TIME):
        if not math.isfinite(cycle_used) or not 0 <= cycle_used <= 70:
            raise ValueError('Cycle used must be between 0 and 70.')
        self.start = self.now = start_time
        self.cycle_at_start = self.cycle_used = round(cycle_used * 3600)
        self.daily_driving = 0
        self.break_driving = 0
        self.window_start = None
        self.events = []
        self.route_seconds_driven = 0
        self.route_distance_miles_driven = 0.0
        self.miles_since_fuel = 0.0
        self.route_progress = None

    def current_location(self):
        if self.route_progress is None:
            return None
        return {'address': f'En route · Mile {self.route_distance_miles_driven:.1f}',
                **self.route_progress.point_at_distance(self.route_distance_miles_driven)}

    def add_event(self, kind, status, seconds, description, location=None, miles=0):
        if seconds < 0:
            raise ValueError('Event duration must be nonnegative.')
        start = self.now
        location = location or self.current_location()
        route_mile = self.route_distance_miles_driven
        if status in ('driving', 'on_duty') and seconds:
            if self.window_start is None:
                self.window_start = start
            self.cycle_used += seconds
        if status == 'driving':
            self.daily_driving += seconds
            self.break_driving += seconds
            self.route_seconds_driven += seconds
            self.route_distance_miles_driven += miles
            self.miles_since_fuel += miles
        elif seconds >= BREAK_DURATION_SECONDS:
            self.break_driving = 0
        if status in ('off_duty', 'sleeper') and seconds >= DAILY_REST_SECONDS:
            self.daily_driving = self.break_driving = 0
            self.window_start = None
        if kind == 'cycle_restart':
            self.cycle_used = 0
        if kind == 'fuel':
            self.miles_since_fuel = 0.0
        self.now += timedelta(seconds=seconds)
        event = {'type': kind, 'status': status, 'start': start.isoformat(),
                 'end': self.now.isoformat(), 'duration_seconds': seconds,
                 'duration_hours': seconds / 3600, 'location': location,
                 'description': description, 'distance_miles': miles,
                 'cycle_used_at_end': self.cycle_used / 3600,
                 'route_mile': route_mile,
                 'route_mile_at_end': self.route_distance_miles_driven}
        self.events.append(event)
        return event

    def rest(self, restart=False):
        self.add_event('cycle_restart' if restart else 'daily_rest', 'off_duty',
                       CYCLE_RESTART_SECONDS if restart else DAILY_REST_SECONDS,
                       '34-hour cycle restart' if restart else '10-hour qualifying rest')

    def on_duty(self, kind, seconds, location, description):
        # Keep each service event whole, and conservatively keep all work within 70h.
        if not 0 < seconds <= CYCLE_LIMIT_SECONDS:
            raise ValueError('Invalid on-duty duration.')
        if CYCLE_LIMIT_SECONDS - self.cycle_used < seconds:
            self.rest(restart=True)
        self.add_event(kind, 'on_duty', seconds, description, location)

    def driving_capacity(self):
        elapsed = int((self.now - self.window_start).total_seconds()) if self.window_start else 0
        return min(MAX_DRIVING_SECONDS - self.daily_driving,
                   DUTY_WINDOW_SECONDS - elapsed,
                   BREAK_TRIGGER_DRIVING_SECONDS - self.break_driving,
                   CYCLE_LIMIT_SECONDS - self.cycle_used)

    def prepare_to_drive(self):
        if self.cycle_used >= CYCLE_LIMIT_SECONDS:
            self.rest(restart=True)
        elif self.daily_driving >= MAX_DRIVING_SECONDS or (
            self.window_start and self.now >= self.window_start + timedelta(seconds=DUTY_WINDOW_SECONDS)
        ):
            self.rest()
        elif self.break_driving >= BREAK_TRIGGER_DRIVING_SECONDS:
            # A short break must not move driving beyond the fixed duty window.
            if self.window_start and self.now + timedelta(seconds=BREAK_DURATION_SECONDS) >= self.window_start + timedelta(seconds=DUTY_WINDOW_SECONDS):
                self.rest()
            else:
                self.add_event('break', 'off_duty', BREAK_DURATION_SECONDS, '30-minute driving break')

    def fuel(self):
        self.on_duty('fuel', FUEL_DURATION_SECONDS, self.current_location(), 'Fuel stop')

    def drive_leg(self, leg):
        seconds = round(leg.get('duration_seconds', leg['duration_hours'] * 3600))
        miles = leg['distance_miles']
        if seconds < 0 or not math.isfinite(miles) or miles < 0 or (seconds == 0 and miles > 0):
            raise ValueError('Invalid route workload.')
        remaining = seconds
        miles_per_second = miles / seconds if seconds else 0
        while remaining:
            fuel_capacity = (FUEL_INTERVAL_MILES - self.miles_since_fuel) / miles_per_second if miles_per_second else math.inf
            # Stop at the last whole second before the distance boundary.
            if fuel_capacity < 1 - 1e-8:
                if self.miles_since_fuel == 0:
                    raise ValueError('Route speed cannot be scheduled at whole-second precision.')
                self.fuel()
                continue
            self.prepare_to_drive()
            fuel_seconds = math.floor(fuel_capacity + 1e-8) if math.isfinite(fuel_capacity) else remaining
            block = min(remaining, self.driving_capacity(), fuel_seconds)
            if block <= 0:
                raise ValueError('Scheduler could not advance.')
            self.add_event('driving', 'driving', block,
                           f"Driving toward {leg['to']['address']}",
                           miles=miles * block / seconds)
            remaining -= block

    def schedule(self, route):
        legs = route['legs']
        if len(legs) != 2:
            raise ValueError('Exactly two route legs are required.')
        geometry = route.get('geometry')
        if geometry:
            self.route_progress = RouteProgress(geometry, route['distance_miles'])
        self.add_event('trip_start', 'off_duty', 0, 'Trip started', legs[0]['from'])
        self.drive_leg(legs[0])
        self.on_duty('pickup', SERVICE_SECONDS, legs[0]['to'], 'Pickup')
        self.drive_leg(legs[1])
        self.on_duty('dropoff', SERVICE_SECONDS, legs[1]['to'], 'Dropoff')
        self.add_event('trip_complete', 'off_duty', 0, 'Trip complete', legs[1]['to'])
        dates = set()
        for event in self.events:
            if event['status'] == 'driving':
                dates |= driving_dates(datetime.fromisoformat(event['start']), datetime.fromisoformat(event['end']))
        summary = {
            'distance_miles': route['distance_miles'], 'driving_hours': route['duration_hours'],
            'trip_duration_hours': (self.now - self.start).total_seconds() / 3600,
            'driving_days': len(dates), 'cycle_used_at_start': self.cycle_at_start / 3600,
            'cycle_used_at_end': self.cycle_used / 3600,
            'cycle_remaining': (CYCLE_LIMIT_SECONDS - self.cycle_used) / 3600,
            'fuel_stops': sum(e['type'] == 'fuel' for e in self.events),
            'required_breaks': sum(e['type'] == 'break' for e in self.events),
            'required_30m_breaks': sum(e['type'] == 'break' for e in self.events),
            'daily_rests': sum(e['type'] == 'daily_rest' for e in self.events),
            'cycle_restarts': sum(e['type'] == 'cycle_restart' for e in self.events),
            'start_time': self.start.isoformat(), 'end_time': self.now.isoformat(),
        }
        compliance = assess_compliance(self.events, self.cycle_at_start)
        fuel_intervals = []
        last_fuel_mile = 0.0
        for event in self.events:
            if event['type'] == 'fuel':
                fuel_intervals.append(event['route_mile'] - last_fuel_mile)
                last_fuel_mile = event['route_mile']
        fuel_intervals.append(self.route_distance_miles_driven - last_fuel_mile)
        max_interval = max(fuel_intervals)
        fuel_ok = max_interval <= FUEL_INTERVAL_MILES + 1e-7
        compliance['fuel'] = {'compliant': fuel_ok, 'max_interval_miles': max_interval,
                              'limit_miles': FUEL_INTERVAL_MILES}
        compliance['compliant'] = compliance['compliant'] and fuel_ok
        return {'summary': summary, 'events': self.events,
                'compliance': compliance,
                'daily_logs': build_daily_logs(self.events, self.cycle_at_start)}


def assess_compliance(events, cycle_at_start):
    daily = since_break = 0
    cycle = cycle_at_start
    window = None
    peaks = {'11_hour_driving_limit': 0, '14_hour_driving_window': 0,
             '30_minute_break': 0, '70_hour_cycle': cycle}
    limits = {'11_hour_driving_limit': MAX_DRIVING_SECONDS,
              '14_hour_driving_window': DUTY_WINDOW_SECONDS,
              '30_minute_break': BREAK_TRIGGER_DRIVING_SECONDS,
              '70_hour_cycle': CYCLE_LIMIT_SECONDS}
    for event in events:
        start, end = datetime.fromisoformat(event['start']), datetime.fromisoformat(event['end'])
        seconds = int((end - start).total_seconds())
        if event['status'] in ('driving', 'on_duty') and seconds:
            window = window or start
            cycle += seconds
        if event['status'] == 'driving':
            daily += seconds
            since_break += seconds
            peaks['11_hour_driving_limit'] = max(peaks['11_hour_driving_limit'], daily)
            peaks['14_hour_driving_window'] = max(peaks['14_hour_driving_window'], int((end-window).total_seconds()))
            peaks['30_minute_break'] = max(peaks['30_minute_break'], since_break)
        elif seconds >= BREAK_DURATION_SECONDS:
            since_break = 0
        peaks['70_hour_cycle'] = max(peaks['70_hour_cycle'], cycle)
        if event['status'] in ('off_duty', 'sleeper') and seconds >= DAILY_REST_SECONDS:
            daily = since_break = 0
            window = None
        if event['type'] == 'cycle_restart' and seconds >= CYCLE_RESTART_SECONDS:
            cycle = 0
    checks = [{'rule': rule, 'status': 'compliant' if value <= limits[rule] else 'violation',
               'max_hours': value / 3600, 'limit_hours': limits[rule] / 3600}
              for rule, value in peaks.items()]
    return {'compliant': all(check['status'] == 'compliant' for check in checks),
            'checks': checks, 'warnings': []}


def build_daily_logs(events, cycle_at_start=0):
    if not events:
        return []
    start = datetime.fromisoformat(events[0]['start'])
    end = datetime.fromisoformat(events[-1]['end'])
    logs = []
    cycle = cycle_at_start
    for number in range((end.date() - start.date()).days + 1):
        midnight = datetime.combine(start.date() + timedelta(days=number), time(), tzinfo=start.tzinfo)
        next_midnight = midnight + timedelta(days=1)
        segments, remarks = [], []
        cursor = 0
        miles = 0
        def append_segment(a, b, status):
            if a == b:
                return
            if segments and segments[-1]['status'] == status and segments[-1]['end_seconds'] == a:
                segments[-1]['end_seconds'] = b
            else:
                segments.append({'start_seconds': a, 'end_seconds': b, 'status': status})
        for event in events:
            a, b = datetime.fromisoformat(event['start']), datetime.fromisoformat(event['end'])
            if midnight <= a < next_midnight:
                address = event['location']['address'] if event.get('location') else 'En route'
                remarks.append(f"{address} — {event['description']}")
            left, right = max(a, midnight), min(b, next_midnight)
            if left < right:
                left_seconds, right_seconds = int((left-midnight).total_seconds()), int((right-midnight).total_seconds())
                append_segment(cursor, left_seconds, 'off_duty')
                append_segment(left_seconds, right_seconds, event['status'])
                cursor = right_seconds
                duration = right_seconds - left_seconds
                if event['status'] in ('driving', 'on_duty'):
                    cycle += duration
                if event['status'] == 'driving':
                    miles += event['distance_miles'] * duration / event['duration_seconds']
            if event['type'] == 'cycle_restart' and midnight < b <= next_midnight:
                cycle = 0
        append_segment(cursor, 86400, 'off_duty')
        totals = {status: sum(s['end_seconds']-s['start_seconds'] for s in segments if s['status'] == status)
                  for status in ('off_duty', 'sleeper', 'driving', 'on_duty')}
        assert sum(totals.values()) == 86400
        logs.append({'day': number+1, 'date': midnight.date().isoformat(),
                     'distance_miles': miles, 'cycle_used': cycle / 3600,
                     'segments': segments, 'totals_seconds': totals,
                     'total_seconds': 86400, 'remarks': remarks})
    return logs
