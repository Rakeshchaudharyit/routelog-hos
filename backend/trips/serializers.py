import math
from datetime import datetime
from .services.hos import DEFAULT_START_TIME
from rest_framework import serializers


class FiniteFloatField(serializers.FloatField):
    def to_internal_value(self, data):
        if isinstance(data, bool):
            self.fail('invalid')
        value = super().to_internal_value(data)
        if not math.isfinite(value):
            self.fail('invalid')
        return value


class LocationSerializer(serializers.Serializer):
    address = serializers.CharField(max_length=500)
    lat = FiniteFloatField(min_value=-90, max_value=90)
    lng = FiniteFloatField(min_value=-180, max_value=180)


class ScheduleDateTimeField(serializers.Field):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError('Provide an ISO datetime.')
        try:
            value = datetime.fromisoformat(data.replace('Z', '+00:00'))
        except ValueError:
            raise serializers.ValidationError('Provide an ISO datetime.')
        if 'T' not in data or value.microsecond or not 1900 <= value.year <= 2099:
            raise serializers.ValidationError('Use an ISO datetime with whole seconds, between 1900 and 2099.')
        return value


class LogMetadataSerializer(serializers.Serializer):
    driver_name = serializers.CharField(max_length=150, required=False)
    co_driver_name = serializers.CharField(max_length=150, required=False, allow_null=True, allow_blank=True)
    carrier_name = serializers.CharField(max_length=200, required=False)
    main_office_address = serializers.CharField(max_length=500, required=False)
    vehicle_number = serializers.CharField(max_length=100, required=False)
    shipping_document_number = serializers.CharField(max_length=150, required=False)


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = LocationSerializer()
    pickup_location = LocationSerializer()
    dropoff_location = LocationSerializer()
    current_cycle_used = FiniteFloatField(min_value=0, max_value=70)
    start_time = ScheduleDateTimeField(required=False, default=DEFAULT_START_TIME)
    log_metadata = LogMetadataSerializer(required=False)


class LocationSearchSerializer(serializers.Serializer):
    q = serializers.CharField(min_length=3, max_length=200, trim_whitespace=True)
