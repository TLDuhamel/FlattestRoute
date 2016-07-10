var directionsDisplay;
var map = null;
var elevator = null;
var polyline;
var routes = null;
var slopes = null;
var distance = null;
var duration = null;
var markersArray = [];
var elevations = [];
var mapPaths = [];
var measurementMode;
var metricUnit = null;
var feetMultiplicator = null;
var sampleSize = 20;
var gradient = new Rainbow();
var animLoop = null;
var toFromFlag = true;
var radiusMarkers = [];
var DirectionsService = new google.maps.DirectionsService();
// Load the visualization API with the columnchart package.
google.load("visualization", "1", {packages: ["columnchart"]});

// Runs after page is loaded.
$(function () {
    var from = getURLParameter('from');
    var to = getURLParameter('to');
    var travelMode = getURLParameter('travelMode');
    measurementMode = getURLParameter('measurementMode');

    // If this link is being shared set to and from
    if (from != "null") {
        $('#from').val(decodeURLParameter(from));
    }

    if (to != "null") {
        $('#to').val(decodeURLParameter(to));
    }

    if (travelMode != "null") {
        $('#travel-mode').val(decodeURLParameter(travelMode));
    }

    if (measurementMode === 'null') {
        measurementMode = 'miles';
    } else {
        $('#measurement-mode').val(decodeURLParameter(measurementMode));
    }

    $("#from-to-switcher").on("click", function (e) {
        var $fromInput = $("#from");
        var $toInput = $("#to");
        var oldFromVal = $fromInput.val();
        $fromInput.val($toInput.val());
        $toInput.val(oldFromVal);
    });

    //  Create event handler that will start the calcRoute function when
    //  the go button is clicked.
    $("form#routes").on("submit", function (e) {

        measurementMode = $("#measurement-mode").val();
        metricUnit = measurementMode == "miles" ? "ft" : "m";
        e.preventDefault();
        calcRoute();
    });

    initialize_maps();
    initAutoComplete('from');
    initAutoComplete('to');

    if (from != "null" && to != "null") {
        calcRoute();
    }
});

function initialize_maps() {
    // Set ability to make route draggable.
    var rendererOptions = {
        draggable: true,
        hideRouteList: true,
        preserveViewport: true,
        polylineOptions: {
            strokeWeight: 0 // Hide the actual path polyline
        },
        markerOptions: {
            opacity: 0.0
        }
        
    };
    // Initialize the directions renderer.
    directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
    var mapCanvas = $('#map-canvas').get(0);
    // Define map style
    var styles = [
      {
        stylers: [
          { hue: "#00ffe6" },
          { saturation: -20 }
        ]
      },{
        featureType: "road",
        elementType: "geometry",
        stylers: [
          { lightness: 100 },
          { visibility: "simplified" }
        ]
      },{
        featureType: "road",
        elementType: "labels",
        stylers: [
          { lightness: 50 },
          { visibility: "on" }
        ]
      }
        ,{
        featureType: "poi",
        elementType: "labels",
        stylers: [
          { visibility: "off" }
        ]
      },{
        featureType: "transit",
        elementType: "all",
        stylers: [
          { weight: 5 }
        ]
      }
    ];
    var mapOptions = {
        center: new google.maps.LatLng(-36.8485, 174.7633),
        zoom: 13,
        // Disables zoom and streetview bar but can stil zoom with mouse.
        disableDefaultUI: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: styles
    };
    // Create a google maps object.
    map = new google.maps.Map(mapCanvas, mapOptions);
    directionsDisplay.setMap(map);
    // Add elevation service.
    elevator = new google.maps.ElevationService();

    // Set up listener to change path elevation information if the user
    // clicks on another suggested route, or drags the A/B markers
    google.maps.event.addListener(
        directionsDisplay,
        'routeindex_changed',
        updateRoutes
    );
    
    google.maps.event.addListener(map, "click", function(event){
        loadRadiusMarkers(event.latLng);
//        geocode(event.latLng);
    });
}

// Geometry code from http://stackoverflow.com/questions/2637023/how-to-calculate-the-latlng-of-a-point-a-certain-distance-away-from-another
Number.prototype.toRad = function() {
   return this * Math.PI / 180;
}
Number.prototype.toDeg = function() {
   return this * 180 / Math.PI;
}
google.maps.LatLng.prototype.destinationPoint = function(brng, dist) {
   dist = dist / 6371;  
   brng = brng.toRad();  

   var lat1 = this.lat().toRad(), lon1 = this.lng().toRad();

   var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + 
                        Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

   var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
                                Math.cos(lat1), 
                                Math.cos(dist) - Math.sin(lat1) *
                                Math.sin(lat2));

   if (isNaN(lat2) || isNaN(lon2)) return null;

    return new google.maps.LatLng(lat2.toDeg(), lon2.toDeg());
}
google.maps.LatLng.prototype.toString = function(){
   return ""+this.lat()+","+this.lng(); // Text representation of latlng
}

function loadRadiusMarkers(Glatlng){
    radius = parseFloat($("#sampleselect").val()); //km
    division = Math.ceil(radius*10.0);
    sliceSize = 360 / division;
    delay = radius*500;
//    geocode(Glatlng, function(Glatlng, origin){
//        for (i = 0; i < division; i++){
//            setTimeout(function(){
//                geocode(Glatlng.destinationPoint(slice*i, radius), function(loc){
//                    if (loc) {
//                        calcRoute(loc, origin);
//                    }
//                });
//            }, i * delay, Glatlng, origin, i);
//        };
//    });
    for (i = 0; i < division; i++){
        slice = sliceSize*i;
        var pointLoc = Glatlng.destinationPoint(slice, radius);
        setTimeout(function(Glatlng, pointLoc){
                calcRoute(pointLoc.toString(), Glatlng);
            }, i * delay, Glatlng, pointLoc);
    };
    
}

// Set to/from from map click
function geocode(latlng, callback){
    var geocoder = new google.maps.Geocoder
    geocoder.geocode({'location': latlng}, function(results, status) {
    if (status === google.maps.GeocoderStatus.OK) {
      if (results[0]) {
//          callback("place_id:"+results[0].place_id);
          callback(latlng, results[0].formatted_address);
//          if (toFromFlag){
//            $("#from").val(results[0].formatted_address);
//          }else{
//            $("#to").val(results[0].formatted_address);
//          }
//          toFromFlag = !toFromFlag;
      } else {
        window.alert('No results found');
      }
    } else {
      console.log('Geocoder failed due to: ' + status);
    }
  });
}

function initAutoComplete(field) {
    var input = document.getElementById(field);
    autocomplete = new google.maps.places.Autocomplete(input);

    // Prevent form submission when selecting place with enter.
    // http://stackoverflow.com/questions/11388251/google-autocomplete-enter-to-select
    $('#' + field).keydown(function (e) {
      if (e.which == 13 && $('.pac-container:visible').length)
        return false;
    });
}

function calcRoute(start, end) {
    var unitSystem = google.maps.UnitSystem.IMPERIAL;
//    var start = $("#from").val() || $("#from").attr("placeholder");
//    var end = $("#to").val() || $("#to").attr("placeholder");
    var travelMode = $("#travel-mode").val();
    if (measurementMode === "km") {
      unitSystem = google.maps.UnitSystem.METRIC;
    };
    var request = {
        origin: start,
        destination: end,
        unitSystem: unitSystem,
        travelMode: google.maps.TravelMode[travelMode.toUpperCase()]
    };
    DirectionsService.route(request, function(result, status) {
        if (status === "NOT_FOUND") {
            alert("No directions found.");
            return;
        }
        // Checks region for directions eligibility.
        if (status == google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(result);
        } else {
            console.log(status);
        }
    });
    //sharableLink(start, end, travelMode);
}
function sharableLink(start, end, travelMode) {
    // Update url to include sharable link
    history.replaceState('null', 'Flat Route Finder', '?from=' + encodeURLParameter(start) + '&to=' + encodeURLParameter(end) +
        '&travelMode=' + travelMode + '&measurementMode=' + measurementMode);
}

var updating = false;
function updateRoutes() {
    if (updating) return;
    updating = true;
    setTimeout(function () { updating = false; }, 100);
    
    // Conditionally remove any existing polylines before drawing a new polyline.
    if (!($('#maintainPath').is(':checked'))){
        if (animLoop){
            clearInterval(animLoop); // Halt animated crawling polylines
        }
        removePolylines();
    }

    var routes = this.directions.routes;
    var path = routes[this.routeIndex].overview_path;
    distance = routes[this.routeIndex].legs[0].distance;
    duration = routes[this.routeIndex].legs[0].duration;

    /* Shows distance in miles or kilometres, depending on measurement mode. */
    if(measurementMode == "miles"){
        $("#distance").html(distance.text);
    }
    else{
        $("#distance").html((distance.value / 1000) + "Km");
    }

    $("#travel-time").html(duration.text);
    $(".travel-info").show();
    newPath(path, distance.value);
}

function newPath(path, distance) {
//    if ($('#userawsamples').is(':checked')){
//        var samples = parseInt($("#sampleselect").val()); // Sample every x metres..
//    }else {
//        var samples = Math.ceil(distance / parseInt($("#sampleselect").val())); // Explicitly set amount of samples
//    }
    var samples = Math.ceil(distance / sampleSize); // Explicitly set amount of samples
    
    if (samples > 512) { // Google will only allow a sample of as many as 512 segments, beyond that we need to break it up into seperate requests.
        //Recursively break it down..
        var mid = Math.floor(path.length / 2);
        var dist = Math.floor(distance/2);
        newPath(path.slice(0, mid), dist);
        var millisecondsToWait = 1500;
        setTimeout(function() { // Give the API a moment to breathe between requests. TODO - this doesn't always work so well. improve it :)
            newPath(path.slice(mid, path.length), dist);
        }, millisecondsToWait);
        return;
    }
    var pathRequest = {
        'path': path,
        'samples': samples
    };
    
    // Initiate the path request.
    elevator.getElevationAlongPath(pathRequest, plotElevation);
}
// Take an array of elevation result objects, draws a path on the map
// and plots the elevation profile on the chart.
function plotElevation(elevations, status) {
    var slope, data, i, slopeChart, elevationChart, slopeChartDiv;
    if (status !== google.maps.ElevationStatus.OK) {
        console.log("Error getting elevation data from Google");
        return;
    }
    // Create a new chart in the elevation chart div.
    elevationChartDiv = $("#elevation_chart").css('display', 'block');
    // Extract the data to populate the chart.
    map.elevationData = new google.visualization.DataTable();
    map.elevationData.addColumn('string', 'Sample');
    map.elevationData.addColumn('number', 'Elevation');
    map.elevationData.locations = [];
    map.elevationData.elevation = [];
    for (i = 0; i < elevations.length; i++) {

        // Change elevation from meters to feet.
        if(measurementMode === "miles"){
            feetMultiplicator = 3.28084;
        }
        else{
            feetMultiplicator = 1;
        }

        map.elevationData.addRow([
            '',
            elevations[i].elevation * feetMultiplicator
        ]);
        map.elevationData.locations.push( elevations[i].location );
        map.elevationData.elevation.push( elevations[i].elevation * feetMultiplicator );

    }

    // Draw the chart using the data within its div.

    elevationChart = new google.visualization.ColumnChart(elevationChartDiv.get(0));
    elevationChart.draw(map.elevationData, {
        width: 350,
        height: 245,
        legend: 'none',
        titleY: 'Elevation ('+metricUnit+')'
    });
    changeElevation(elevationChart, elevations);
}
function changeElevation(elevationChart, elevations) {
    // Create event listenter on slope to show location and elevation.
    google.visualization.events.addListener(elevationChart, 'onmouseover', elevationHover);
    google.visualization.events.addListener(elevationChart, 'onmouseout',
        elevationClear);

    plotSlope(elevations);
}
function plotSlope(elevations){
    slopeChartDiv = $("#slope_chart").css('display', 'block');
    // Extract the data to populate the chart.
    map.slopeData = new google.visualization.DataTable();
    map.slopeData.addColumn('string', 'Sample');
    map.slopeData.addColumn('number', 'Slope');

    // Loop through each element of the elevation data,
    // call the calc slope function using elevations.legth[i]
    // and elevations.length[i+1]
    // Create a slopes array so we can search through it later
    slopes = [];
    for (i = 0; i < elevations.length - 1; i++) {
        slope = (calcSlope(elevations[i+1].elevation, elevations[i].elevation, sampleSize)) * 100;
        map.slopeData.addRow(['', slope]);
        slopes.push({
            slope: slope,
            location: midpoint(elevations[i], elevations[i+1])
        });
    }

// Draw the chart using the slope data within its div.
    slopeChart = new google.visualization.ColumnChart(slopeChartDiv.get(0));
    slopeChart.draw(map.slopeData, {
        width: 350,
        height: 245,
        legend: 'none',
        titleY: 'slope %'
    });
    $('.chart').removeClass('hide');
    changeSlope(slopeChart, elevations, slopes);
}
function changeSlope(slopeChart, elevations, slopes) {
    // Create event listenter on slope to show location and slope.
    google.visualization.events.addListener(slopeChart, 'onmouseover', elevationHover);
    google.visualization.events.addListener(slopeChart, 'onmouseout',
        elevationClear);
    drawPolyline(elevations, slopes);
}

function removePolylines() {
    for (var i = 0; i < mapPaths.length; i++) {
        var path = mapPaths[i];
        path.setMap(null);
    }

    mapPaths = [];
}

// Colour functions adapted from http://krazydad.com/tutorials/makecolors.php
function getColourFromSlope(value)
{
    value = value * 0.7
    frequency1 = .1;
    frequency2 = .1;
    frequency3 = .1;
    phase1 = 0;
    phase2 = 2;
    phase3 = 4;
    //center = 128;
//    width = 127;
    center = 100;
    width = 150;;
//    center = 100;
//    width = 200;

    var red = Math.sin(frequency1*value + phase1) * width + center;
    var grn = Math.sin(frequency2*value + phase2) * width + center;
    var blu = Math.sin(frequency3*value + phase3) * width + center;
    return RGB2Color(red,grn,blu);
}
function RGB2Color(r,g,b)
{
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}

function drawPolyline (elevations, slopes) {
    
    //animated
    var framerate = 1;
    var i = 0;
    if (!($('#maintainPath').is(':checked'))){
        animLoop = setInterval(frame, framerate); // use the 'static' animLoop
    } else {
        var newLoop = setInterval(frame, framerate); // create a new animLoop for each path drawn
    }
    function frame() {
        if (i >= slopes.length) {
            if (animLoop != null){clearInterval(animLoop); }
            if (newLoop || newLoop != null) {clearInterval(newLoop); }
        } else {
            // Create a polyline between each elevation, color code by slope.
            var routePath = [
                elevations[i].location,
                elevations[i+1].location
            ];
            var absSlope = Math.abs(slopes[i].slope);
            if (absSlope > 30){ // This is typically seen on bridges - where slope data causes issues (slope measuring underlying geography)
                absSlope = 0;
            }
            strokeWeight = 1.7 + (absSlope * 0.3); // Gives a nice min/max stroke weight
            gradient.setSpectrum('#1aff53', '#ffc61a','#ff531a');
            gradient.setNumberRange(0, 3);
            colourValue = Math.log(absSlope);

            mapPath = new google.maps.Polyline({
                path: routePath,
        //            strokeColor: getColourFromSlope(absSlope),
                strokeColor: '#'+gradient.colourAt(colourValue),
                strokeOpacity: 1,
                strokeWeight: strokeWeight,
                draggable: false,
                zIndex: absSlope // ensures that steeper areas will show up above flatter segments
            });
            mapPath.setMap(map);
            mapPaths.push(mapPath);
            i++;
        }
    }
}

function deg(slope) {
    return Math.floor(slope * 45) / 100;
}

function elevationHover (x) {
    // Show location on the map.
    var location = map.elevationData.locations[x.row];
    var elevation = map.elevationData.elevation[x.row];
    var slope = slopes[x.row].slope;
    var contentString = "Elevation: " + Math.round(elevation) + " " + metricUnit + "<br>" +
        "Slope: " + Math.round(slope) + "% (" + deg(slope) + "&#176;)";

    map.locationMarker = new google.maps.Marker({
        position: location,
        map: map,
        labelContent: "Lat: " + location.lat() + ". Lng: " + location.lng() +
            ". Elevation: " + elevation
    });
    addinfoWindow(contentString);
}
function addinfoWindow(contentString) {
    // Add info window to the map.
    map.infowindow = new google.maps.InfoWindow({
        content: contentString
    });
    map.infowindow.open(map, map.locationMarker);
}
function elevationClear (x) {
    map.locationMarker.setMap(null);
}

function midpoint(point1, point2) {
    // To get the midpoint, find the average between each respective point
    var lat = (point1.location.lat() + point2.location.lat()) / 2;
    var lng = (point1.location.lng() + point2.location.lng()) / 2;
    return new google.maps.LatLng(lat, lng);
}

// Calculate slope using elevation change between two points
// over a given distance in m, the distance between each measurement.
function calcSlope(elev1M, elev2M, distanceM) {
    slope = (elev1M - elev2M) / distanceM;
    return slope;
}

// Gets the 'to' and 'from' url Parameter for sharing links
// Source: http://stackoverflow.com/questions/1403888/get-url-parameter-with-jquery
function getURLParameter(name) {
    return decodeURIComponent((RegExp(name + '=' + '(.+?)(&|$)')
        .exec(location.search)||[,null])[1]);
}

//change spaces to plus(+) sign
function encodeURLParameter(str) {
  return encodeURIComponent(str).replace(/%20/g, "+");
}

//change plus(+) sign to spaces
function decodeURLParameter(str) {
  return decodeURIComponent(str).replace(/[!'()]/g, escape)
    .replace(/\+/g, " ");
}
