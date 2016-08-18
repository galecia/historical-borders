'use strict';

var utils = new Utils();
var homeLink = $('#home');
var title = $('#page-title');
var dateList = $('#date-list');
var datePager = $('#date-pager');
var hash = utils.getHash(); // this may have to be changed for production

// Jim: update this URL/attribution string if you need
var baseMapUrl = 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
var baseMapAttribution = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>';

var basemap = new L.tileLayer(baseMapUrl, {
  attribution: baseMapAttribution
});
var mapOpts = {
  center: [39, -97],
  scrollWheelZoom: false,
  zoom: 4
};
var map = new L.Map('map', mapOpts);
var router = new Router({
	'/': mapsMainPage,
	'/:state': loadStateMap
});
var activeLayer = [];

map.addLayer(basemap);

initializeForm();
initializeInfo();
startRouter();

// Set up initial form values and event handlers for form changes
function initializeForm() {
	initializeDateList();

	datePager.on('change click', '*', pageDate);

	homeLink.on('click', function(event) {
		event.preventDefault();

		router.setRoute('/');
	});
}

function initializeDateList() {
  var initialDateOption = $('<option value="initial">-- Select a Border Start Date --</option>');
  dateList.empty();
  dateList.append(initialDateOption);
}

function initializeInfo() {
  var info = $('#info');
  info.children('.name').text('');
  info.children('.dates').text('');
  info.children('.change').text('Hover your mouse pointer over a territory to view the historical record about this border change.');
}

// initialize the router
function startRouter() {
	// make sure the url has a hash so the router doesn't break
	// change this for production
	if (hash === '' || hash === '/') {
		// window.location = '/maproot/map.html#'; // ideally, remove this bloody index.html nonsense
	}

	router.configure({
		// uncomment html5history if the server supports clean urls
		// change this for production
		// html5history: true,
		notfound: mapsMainPage
	});

	router.init('/');
}

/**
 * Routes
 */

function mapsMainPage() {
	homeLink.addClass('hidden');

	title.text('Maps');

	initializeInfo();

	initializeDateList();
	datePager.attr('disabled', 'disabled');

	if (activeLayer.length) {
		activeLayer = activeLayer.reduce(function(empty, layer) {
			map.removeLayer(layer);

			return empty;
		}, []);
	}

	cartodb.createLayer(map, 'https://newberrydis.carto.com/api/v2/viz/6b8d5f72-4d05-11e6-8f00-0ee66e2c9693/viz.json')
		.addTo(map)
		.on('done', function(layer) {
			activeLayer.push(layer);

			// map.fitBounds(layer);
			map.setView(mapOpts.center, mapOpts.zoom);

			console.log('main map done');
		});
}

function loadStateMap(state) {
	var stateName = statesList[state];
	var dateListQuery = 'SELECT DISTINCT ON (start_date) start_date, to_char(start_date, \'MM-DD-YYYY\') date FROM us_histcounties_gen001 WHERE state_terr ILIKE \'\%' + stateName + '\%\' ORDER BY start_date ASC';
	var getDateList = $.getJSON(encodeURI('https://newberrydis.cartodb.com/api/v2/sql/?q=' + dateListQuery));

	homeLink.removeClass('hidden');

	title.text(stateName);

	datePager.removeAttr('disabled');

	initializeInfo();

	getDateList
		.done(populateDateList)
		.done(setInitialLayer(state));
}

/**
 * Events
 */

function pageDate(event) {
	event.preventDefault();

	var val = event.target.value.trim();
	var fromList = !!parseInt(val, 10);
	var selectedEl = dateList.find('option[value="' + dateList.val() + '"]');
	var state = utils.getHash();
	var bumperVal;

	if (fromList) {
		getLayersForDate(val, state);
	} else if (val === 'initial') {
		return;
	} else {
		bumperVal = selectedEl[val]().val();

		dateList.val(bumperVal);

		if (bumperVal === 'initial' || typeof bumperVal === 'undefined') {
			return;
		}

		getLayersForDate(bumperVal, state);
	}
}

function updateDate(event) {
	event.preventDefault();

	var date = event.target.value;

	console.log('updating Date field', event.target, date);
}

function viewState(event) {
	event.preventDefault();

	var state = event.target.value;

	router.setRoute(state);
}

/**
 * Data
 */

function populateDateList(data) {
	initializeDateList();
	$.each(data.rows, function(key, val) {
		var dateOption = $('<option value="' + val.date + '">' + val.date + '</option>');

		dateList.append(dateOption);
	});
}

function setInitialLayer(state) {
	return function(data) {
		var date = data.rows.shift().start_date;

		getLayersForDate(date, state);
	}
}

function getLayersForDate(date, state) {
	var stateName = statesList[state];
	var layerQuery = 'SELECT ST_AsGeoJSON(the_geom) as geo, full_name, change, start_date, end_date FROM us_histcounties_gen001 WHERE state_terr ILIKE \'\%' + stateName + '\%\' AND start_date <= \'' + date + '\' AND end_date >= \'' + date + '\'';

	return $.getJSON(encodeURI('https://newberrydis.cartodb.com/api/v2/sql/?q=' + layerQuery)).done(function(data) {
		var feature = getFeatureFromData(data),
			layerToDisplay = L.geoJson(feature, {
				onEachFeature: function(feature, layer) {
					layer.on('mouseover', utils.debounce(function(event) {
						populateInfo(feature.properties);
					}, 50));
				}
			});

		if (activeLayer.length) {
			activeLayer = activeLayer.reduce(function(empty, layer) {
				map.removeLayer(layer);

				return empty;
			}, []);
		}

		activeLayer.push(layerToDisplay);

		layerToDisplay.addTo(map);

		map.fitBounds(layerToDisplay);

		layerToDisplay.resetStyle();
	});
}

function getFeatureFromData(data) {
	var feature = [],
		i, currentRow, rowFeature;

	for (i = 0; i < data.rows.length; i++) {
		currentRow = data.rows[i];
		rowFeature = JSON.parse(currentRow.geo);

		feature.push({
			type: 'Feature',
			geometry: rowFeature,
			properties: {
				fullName: currentRow.full_name,
				change: currentRow.change,
				dates: {
					start: currentRow.start_date,
					end: currentRow.end_date
				}
			}
		});
	}

	return feature;
}

function populateInfo(data) {
	var info = $('#info'),
		startDate = new Date(data.dates.start),
		start = startDate.toDateString(),
		endDate = new Date(data.dates.end),
		end = endDate.toDateString();

	info.addClass('active');

	info.children('.name').text(data.fullName);
	info.children('.dates').text(start + ' - ' + end);
	info.children('.change').text(data.change);

	setTimeout(function() {
		info.removeClass('active');
	}, 200);
}

/**
 * Utilities
 */

function Utils() {
	return {
		getHash: function() {
			return window.location.hash.replace(/^[#\/]+/, '');
		},
		getTodaysDate: function() {
			var today = new Date();
			var month = initialZero(today.getMonth() + 1);
			var date = initialZero(today.getDate());

			return today.getFullYear()+'-'+month+'-'+date;
		},
		debounce: function(func, wait, immediate) {
			var timeout;
			return function() {
				var context = this, args = arguments;
				var later = function() {
					timeout = null;
					if (!immediate) func.apply(context, args);
				};
				var callNow = immediate && !timeout;
				clearTimeout(timeout);
				timeout = setTimeout(later, wait);
				if (callNow) func.apply(context, args);
			};
		}
	}

	function initialZero (int) {
		var num = String(int);

		return (num.length > 1) ? num : '0' + num;
	}
}
