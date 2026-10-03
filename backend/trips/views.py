from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import TripPlanRequestSerializer
from .services.planning import plan_trip as plan_trip_service
from .services.routing import RoutingError
from .services.daily_logs import DailyLogError


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def plan_trip(request):
    serializer = TripPlanRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        return Response(plan_trip_service(serializer.validated_data))
    except (RoutingError, DailyLogError) as error:
        return Response({"detail": str(error)}, status=error.status_code)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_locations_view(request):
    from .serializers import LocationSearchSerializer
    from .services.geocoding import search_locations, GeocodingError, GeocodingBusy
    serializer = LocationSearchSerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    try:
        return Response({'results': search_locations(serializer.validated_data['q'])})
    except GeocodingBusy as error:
        return Response({'detail': str(error)}, status=503, headers={'Retry-After': '2'})
    except GeocodingError as error:
        return Response({'detail': str(error)}, status=502)
