import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function moduleUrl(path, imports = {}, env = {}) {
  let code = ts.transpileModule(
    fs.readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  code = code.replaceAll("import.meta.env", JSON.stringify(env));
  for (const [name, url] of Object.entries(imports))
    code = code
      .replaceAll(`"${name}"`, JSON.stringify(url))
      .replaceAll(`'${name}'`, JSON.stringify(url));
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const locationUrl = moduleUrl("../src/types/location.ts");
const apiUrl = moduleUrl("../src/services/api.ts");
const dailyLogUrl = moduleUrl("../src/types/dailyLog.ts");
const tripsUrl = moduleUrl("../src/services/trips.ts", {
  "../types/location": locationUrl,
  "./api": apiUrl,
  "../types/dailyLog": dailyLogUrl,
});
const { isValidLocation } = await import(locationUrl);
const { toTripRequest, planTrip } = await import(tripsUrl);
const { defaultInput } = await import(moduleUrl("../src/data/demoTrip.ts"));
assert.equal(isValidLocation(defaultInput.currentLocation), true);
for (const value of [
  null,
  { ...defaultInput.currentLocation, address: "" },
  { ...defaultInput.currentLocation, lat: NaN },
  { ...defaultInput.currentLocation, lng: 181 },
])
  assert.equal(isValidLocation(value), false);
assert.throws(
  () => toTripRequest({ ...defaultInput, pickupLocation: null }),
  /select an address/,
);
const payload = toTripRequest(defaultInput);
assert.deepEqual(payload.current_location, {
  address: "Atlanta, GA, USA",
  lat: 33.749,
  lng: -84.388,
});
const fixture = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/scheduled-trip.json", import.meta.url),
    "utf8",
  ),
);
fixture.requested_locations = {
  current_location: payload.current_location,
  pickup_location: payload.pickup_location,
  dropoff_location: payload.dropoff_location,
};
fixture.current_cycle_used = 18;
fixture.status = 'ok';
fixture.hos_status = 'calculated';
fixture.route = {distance_miles:912,duration_hours:15.75,geometry:{type:'LineString',coordinates:[[-84.388,33.749],[-86.7816,36.1627],[-96.797,32.7767]]},legs:[{from:payload.current_location,to:payload.pickup_location,distance_miles:250,duration_hours:4},{from:payload.pickup_location,to:payload.dropoff_location,distance_miles:662,duration_hours:11.75}]};
const {leafletCoordinates,drivingTime}=await import(moduleUrl('../src/types/route.ts'));
assert.deepEqual(leafletCoordinates(fixture.route.geometry)[0],[33.749,-84.388]);
assert.equal(drivingTime(15.75),'15h 45m');
let posted;
globalThis.fetch = async (url, options) => {
  assert.equal(url, "/api/trips/plan/");
  posted = JSON.parse(options.body);
  return new Response(JSON.stringify(fixture), { status: 200 });
};
const planned=await planTrip(defaultInput);
assert.equal(planned.summary.distance,912);
assert.equal(planned.summary.durationHours,27.75);
assert.equal(planned.schedule.daily_rests,1);
assert.equal(planned.compliance.compliant,true);
assert.equal(planned.events.filter(event=>event.type==='pickup')[0].duration_seconds,3600);
assert.equal(planned.daily_logs.length,2);
for(const log of planned.daily_logs) assert.ok(Math.abs(log.segments.reduce((total,segment)=>total+segment.end-segment.start,0)-24)<1e-9);
const {dateLabel,clockLabel}=await import(moduleUrl('../src/types/schedule.ts'));
assert.equal(dateLabel('2026-10-05T23:00:00-05:00'),'Oct 5');
assert.equal(clockLabel('2026-10-05T23:00:00-05:00'),'23:00:00');
assert.equal(toTripRequest({...defaultInput,startTime:'2026-10-07T23:00:00'}).start_time,'2026-10-07T23:00:00');
assert.equal(planned.route.legs[0].distanceMiles,250);
assert.equal(planned.route.durationHours,15.75);
assert.deepEqual(posted, payload);
globalThis.fetch = async () => {
  throw new Error("offline");
};
await assert.rejects(
  planTrip(defaultInput),
  /Unable to reach the trip service/,
);
globalThis.fetch = async () =>
  new Response(JSON.stringify({ pickup_location: ["required"] }), {
    status: 400,
  });
await assert.rejects(
  planTrip(defaultInput),
  (error) => error.status === 400 && !!error.details.pickup_location,
);
globalThis.fetch = async () => new Response("{}", { status: 200 });
await assert.rejects(planTrip(defaultInput), /incomplete result/);

console.log("Trip payload conversion, location validation and API failure handling passed.");
const locationsUrl = moduleUrl('../src/services/locations.ts', {'../types/location':locationUrl,'./api':apiUrl});
const {searchLocations}=await import(locationsUrl);
let searches=0;
globalThis.fetch=async(url)=>{searches++;assert.ok(url.includes('/locations/search/?q=Dallas'));return new Response(JSON.stringify({results:Array.from({length:6},(_,i)=>({address:`Dallas ${i}`,lat:32.7767,lng:-96.797,type:'city',importance:.8}))}),{status:200});};
assert.deepEqual(await searchLocations('ab'),[]);assert.equal(searches,0);assert.equal((await searchLocations(' Dallas ')).length,5);
globalThis.fetch=async()=>new Response(JSON.stringify({detail:'Address search is temporarily unavailable.'}),{status:502});await assert.rejects(searchLocations('Dallas'),/temporarily unavailable/);
console.log('Location service threshold, normalized results, result limit and upstream error handling passed.');

for (const route of [
 {...fixture.route,geometry:{type:'LineString',coordinates:[[181,0],[0,0]]}},
 {...fixture.route,legs:[{...fixture.route.legs[0],from:null},fixture.route.legs[1]]},
 {...fixture.route,distance_miles:-1},
]) {
 globalThis.fetch=async()=>new Response(JSON.stringify({...fixture,route}),{status:200});
 await assert.rejects(planTrip(defaultInput),/invalid geometry|incomplete result/);
}
globalThis.fetch=async()=>new Response(JSON.stringify({detail:'No driving route was found between the selected locations.'}),{status:422});
await assert.rejects(planTrip(defaultInput),/No driving route/);
console.log('Route metrics, leg validation, GeoJSON coordinate conversion and no-route errors passed.');

const {routeStops,stopLabels}=await import(moduleUrl('../src/types/schedule.ts'));
const stops=routeStops(planned.events);
assert.deepEqual(stops.map(stop=>stop.type),['trip_start','pickup','daily_rest','dropoff']);
assert.ok(stops.every(stop=>Number.isFinite(stop.location.lat)&&Number.isFinite(stop.route_mile)));
assert.ok(!stops.some(stop=>stop.type==='fuel'));
assert.equal(planned.schedule.fuel_stops,0);
assert.equal(planned.compliance.fuel.compliant,true);
const fuel={...stops[2],type:'fuel',duration_seconds:1800,status:'on_duty'};
assert.equal(routeStops([fuel])[0].type,'fuel');
assert.equal(stopLabels.fuel,'Fuel');
console.log('Dynamic geographic stop selection, no fake fuel, and fuel compliance passed.');

const {validateDailyLog}=await import(dailyLogUrl);
assert.equal(planned.daily_logs[0].driver.name,'Alex Morgan');
assert.equal(planned.daily_logs[0].carrier.name,'RouteLog Demo Transport');
assert.equal(planned.daily_logs[0].certification.certified,false);
assert.ok(planned.daily_logs[0].remarkDetails.every(remark=>remark.time.startsWith(planned.daily_logs[0].date)));
for(const modify of [log=>log.total_seconds=80000,log=>log.totals.driving=NaN,log=>log.segments[1].start_seconds=0,log=>log.driver.name='',log=>log.total_miles=-1,log=>log.date='2026-02-30']) {
 const log=structuredClone(fixture.daily_logs[0]);modify(log);
 assert.throws(()=>validateDailyLog(log),/invalid daily log/);
}
console.log('Daily log metadata, certification, dated remarks and strict duty coverage validation passed.');
