from django.test import SimpleTestCase
from .services.route_progress import RouteProgress, point_at_distance, haversine_miles


class RouteProgressTests(SimpleTestCase):
    def setUp(self):
        self.geometry={'type':'LineString','coordinates':[[0,0],[1,0],[1,1]]}

    def test_segment_haversine(self):
        self.assertAlmostEqual(haversine_miles([0,0],[1,0]),69.0934,places=3)
        self.assertEqual(haversine_miles([0,0],[0,0]),0)

    def test_normalized_progress_follows_bend(self):
        point=point_at_distance(self.geometry,1000,2000)
        self.assertAlmostEqual(point['lng'],1)
        self.assertAlmostEqual(point['lat'],0)
        point=point_at_distance(self.geometry,1500,2000)
        self.assertAlmostEqual(point['lng'],1)
        self.assertAlmostEqual(point['lat'],.5)

    def test_endpoints_and_clamping(self):
        progress=RouteProgress(self.geometry,1000)
        self.assertEqual(progress.point_at_distance(-1),{'lng':0,'lat':0})
        self.assertEqual(progress.point_at_distance(1001),{'lng':1,'lat':1})

    def test_duplicates_and_zero_geometry(self):
        geometry={'type':'LineString','coordinates':[[0,0],[0,0],[1,0],[1,0]]}
        self.assertAlmostEqual(point_at_distance(geometry,50,100)['lng'],.5)
        geometry['coordinates']=[[2,3],[2,3]]
        self.assertEqual(point_at_distance(geometry,50,100),{'lng':2,'lat':3})

    def test_dateline_short_segment(self):
        geometry={'type':'LineString','coordinates':[[179,0],[-179,0]]}
        self.assertAlmostEqual(abs(point_at_distance(geometry,50,100)['lng']),180)

    def test_invalid_geometry_or_distance(self):
        for geometry in ({'type':'Point','coordinates':[]},{'type':'LineString','coordinates':[[181,0],[0,0]]}):
            with self.assertRaises(ValueError): RouteProgress(geometry)
        with self.assertRaises(ValueError): point_at_distance(self.geometry,float('nan'))
